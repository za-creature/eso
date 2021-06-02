import {AUDIO_BITRATES, BATCH_MAXRATE, PROFILES, SEGMENT_LENGTH} from '../config'

import update_metadata from './aws'
import {input, output} from './buckets'
import {sign, verify} from './crypto'
import call from './subprocess'

import fs from 'fs'

// multimedia profile index table
const [P_WIDTH, P_HEIGHT, P_FRAMERATE, P_BITRATE, P_VBR, P_CHANNELS] = Array(6).keys()

// max runtime is 9 minutes, but use 20 to account for clock drift
const SIGNING_OPTS = {action: 'read', get expires() {
    return Date.now() + 20 * 60 * 1000
}}

// ffmpeg stderr regular expressions
const SEGMENT_REGEX = /\[segment @.*\/(\d+)\.ts/
const VIDEO_REGEX = /^\s*Stream\s#.*Video.*\s\(default\)\s*$/
const AUDIO_REGEX = /^\s*Stream\s#.*Audio.*\s\(default\)\s*$/
export async function split_into_segments(key) {
    // create meta entry before running ffmpeg to avoid race conditions
    await update_metadata(key, {
        UpdateExpression: 'SET thumb = :thumb',
        ConditionExpression: 'attribute_not_exists(total_segments)',
        ExpressionAttributeValues: {':thumb': {BOOL: false}}
    })

    // spawn ffmpeg and stream over stderr line by line
    let [url] = await input.file(key).getSignedUrl(SIGNING_OPTS)
    let proc = call(process.env.FFMPEG, [
                    '-i', url, '-y',
                    '-c:v', 'copy',
                    '-c:a', 'pcm_f32le',
                    '-map_metadata', '-1',
                    '-f', 'segment',
                    '-segment_time', '' + SEGMENT_LENGTH,
                    '-segment_list', `${process.env.RAMDISK}playlist.m3u8`,
                    '-segment_format', 'nut',
                    `${process.env.RAMDISK}%d.ts`])
    let last, seen = new Set()
    let profiles, metadata
    try {
        let line, info = [1e9, 1e9, 1e9, 1e9, 1e9, 0]
        while(line = await proc.line()) {
            // extract media information from stderr; currently (ffmpeg 4.2.2)
            // this is guaranteed to happen before the first segment is started
            // and it is only needed after the second segment is produced
            let match
            if(!last) {
                if(line.match(VIDEO_REGEX)) {
                    if(match = line.match(/\s(\d+)x(\d+)[\s,]/i)) {
                        info[P_WIDTH] = match[1]|0
                        info[P_HEIGHT] = match[2]|0
                    }
                    if(match = line.match(/\s(\d+)\skb[/p]s/i))
                        info[P_BITRATE] = match[1]|0
                    if(match = line.match(/\s([\d\\.]+)\s(fps|tbr)/i))
                        info[P_FRAMERATE] = parseFloat(match[1])
                    continue
                }
                if(line.match(AUDIO_REGEX)) {
                    if(match = line.match(/\s(\d+)\skb\/s/i))
                        info[P_VBR] = match[1]|0
                    info[P_CHANNELS] = line.match(/mono/i) ? 1 : 2
                    continue
                }
            } else if(!metadata) {
                profiles = ffmpeg_args(info)
                metadata = serialize_metadata(profiles)
            }

            // watch stderr for new segments, deduplicate and upload them as
            // soon as they are flushed to ramdisk; the current ffmpeg
            // implementation flushes a segment before it starts writing to a
            // new one so delaying uploads by one segment is _reasonably_ safe;
            if(!(match = line.match(SEGMENT_REGEX)))
                continue
            let segment = match[1]
            if(seen.has(segment))
                continue
            seen.add(segment)

            // in the (unlikely) case of backpressure from cloud storage uploads,
            // ffmpeg should start blocking once the stderr pipe buffer full,
            // though this behavior was never actually tested as cloud function
            // to cloud storage peering has better throughput than ffmpeg's muxer
            if(last)
                await upload_segment(key, last, metadata)
            last = segment
            // if for some reason you're porting this to a slower provider, you
            // could respond to backpressure by sending SIGSTOP and SIGCONT
        }

        // wait for subprocess and mark file as unsupported if ffmpeg crashes
        // or does not produce output as this error is permanent
        try {
            await proc
            if(!last)
                throw new Error('No segments created')
        } catch(err) {
            await update_metadata(key, {
                UpdateExpression: 'SET total_segments = :segments',
                ExpressionAttributeValues: {':segments': {N: '-1'}}
            })
            throw err
        }
    } finally {
        await proc.kill()
    }

    // upload last segment after ffmpeg returned
    await upload_segment(key, last, metadata)

    // set real number of segments in metadata table
    await update_metadata(key, {
        UpdateExpression: 'SET total_segments = :segments',
        ExpressionAttributeValues: {':segments': {N: '' + seen.size}}
    })

    // build master playlist
    let playlist = ['#EXTM3U']
    let playlists = profiles.map(profile => {
        // upload segment playlist for each profile
        playlist.push('#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=' +
                      (profile.bitrate << 10))
        playlist.push(`${profile.bitrate}k/index.m3u8`)
        return output.upload(`${process.env.RAMDISK}playlist.m3u8`, {
            destination: `${key}/${profile.bitrate}k/index.m3u8`,
            resumable: false
        })
    })

    // upload all playlists then delete local segment playlist
    playlists.push(output.file(`${key}/index.m3u8`)
                         .save(Buffer.from(playlist.join('\n') + '\n', 'utf-8'),
                               {resumable: false}))
    await Promise.all(playlists)
    await fs.promises.unlink(`${process.env.RAMDISK}playlist.m3u8`)
}


async function upload_segment(key, segment, metadata) {
    // start uploading segment with metadata to trigger segment transcoder
    let filename = `${process.env.RAMDISK}${segment}.ts`
    let upload = input.upload(filename, {destination: `${key}/${segment}.ts`,
                                         metadata: {metadata}, // yo dawg
                                         resumable: false})

    // extract and upload a thumbnail from first segment to output bucket
    if(segment == '0')
        await Promise.all([upload, upload_thumbnail(key, filename)])
    else
        await upload

    // wait for upload(s) to complete, then delete local segment from ramdisk
    await fs.promises.unlink(filename)
}


async function upload_thumbnail(key, filename) {
    try {
        // do a best effort to extract thumbnail
        let thumb = `${process.env.RAMDISK}thumbnail.jpeg`
        await call(process.env.FFMPEG, [
                   '-i', filename,
                   '-vf', 'select=\'eq(pict_type,I)\'',
                   '-vframes', '1',
                   '-q:v', '2',
                   '-huffman', 'optimal',
                   '-f', 'singlejpeg', thumb])

        // upload and delete
        await output.upload(thumb, {destination: `${key}/thumb.jpeg`,
                                    resumable: false})
        await fs.promises.unlink(thumb)

        // mark key as having a thumbnail
        await update_metadata(key, {
            UpdateExpression: 'SET thumb = :thumb',
            ExpressionAttributeValues: {':thumb': {BOOL: true}}
        })
    } catch(err) {
        console.error('Unable to extract thumbnail')
        console.log(err.stack)
    }
}


function ffmpeg_args(video) {
    // figure out how many profiles we need to support based on input resolution
    let i = 0, profile, profiles = []
    do {
        profiles.push(profile = PROFILES[i++])
    } while(
        i < PROFILES.length &&
        profile[P_WIDTH] <= video[P_WIDTH] &&
        profile[P_HEIGHT] <= video[P_HEIGHT]
    )

    // convert profiles into ffmpeg args
    return profiles.map(profile => {
        let video_bitrate = Math.min(video[P_BITRATE], profile[P_BITRATE])
        const tw = profile[P_WIDTH]
        const th = profile[P_HEIGHT]
        let args = ['-c:v', 'libx264',
                    '-b:v', `${video_bitrate}k`,
                    '-maxrate', `${Math.floor(video_bitrate * 5 / 4)}k`,
                    '-bufsize', `${Math.floor(video_bitrate * 5 / 2)}k`,
                    '-vsync', 'vfr',
                    '-r', '' + Math.min(video[P_FRAMERATE], profile[P_FRAMERATE]),
                    '-tune', 'film',
                    '-filter:v', 'scale=\'' +
                                 `2*trunc(min(iw,min(${th},${tw}/dar)*dar)/2):` +
                                 `2*trunc(min(ih,min(${tw},${th}*dar)/dar)/2)'`,
                    '-preset:v', 'slow',
                    '-profile:v', 'main',
                    '-level:v', '3.1',
                    '-copyts']

        if(!video[P_CHANNELS]) {
            // input file seems to be video only
            args.push('-an')
            return {args, bitrate: video_bitrate}
        }

        // downmix to mono / stereo
        let audio_bitrate = video[P_VBR] / video[P_CHANNELS]
        let channels = Math.min(video[P_CHANNELS], profile[P_CHANNELS])
        audio_bitrate *= channels

        // find highest output-bitrate vbr mode within profile restriction that
        // has max output bitrate lower than the average channel input bitrate
        let vbr = 1
        for(let max of AUDIO_BITRATES[channels-1].slice(1, profile[P_VBR]))
            if(max <= audio_bitrate)
                vbr++

        args.push('-c:a', 'libfdk_aac',
                  '-vbr', '' + vbr,
                  '-ac', '' + channels)
        return {
            args,
            bitrate: video_bitrate + AUDIO_BITRATES[channels-1][vbr]
        }
    })
}


function serialize_metadata(profiles) {
    // split profiles into batches and serialize to signed base64
    let batches = [], batch = [], bitrate = 0
    for(let profile of profiles) {
        if(bitrate && bitrate + profile.bitrate > BATCH_MAXRATE) {
            batches.push(batch)
            batch = []
            bitrate = 0
        }
        batch.push(profile)
        bitrate += profile.bitrate
    }
    batches.push(batch)
    return {eso: sign(batches)}
}


export async function convert_segment(key, segment, metadata) {
    let [url] = await input.file(`${key}/${segment}.ts`).getSignedUrl(SIGNING_OPTS)
    for(let batch of verify(metadata)) {
        // populate ffmpeg args and build output list for this batch
        let args = ['-i', url, '-y']
        let uploads = []
        for(let profile of batch) {
            let filename = `${process.env.RAMDISK}${profile.bitrate}.ts`
            args.push(...profile.args)
            args.push(filename)
            uploads.push([filename, `${key}/${profile.bitrate}k/${segment}.ts`])
        }

        // convert current batch using generated args
        await call(process.env.FFMPEG, args)

        // upload and delete output segments
        await Promise.all(uploads.map(async ([filename, destination]) => {
            await output.upload(filename, {destination, resumable: false})
            await fs.promises.unlink(filename)
        }))
    }

    await Promise.all([
        input.file(`${key}/${segment}.ts`).delete(), // delete input segment
        update_metadata(key, { // mark segment ready
            UpdateExpression: 'ADD segments_ready :ready',
            ExpressionAttributeValues: {':ready': {NS: [segment]}}
        })
    ])
}
