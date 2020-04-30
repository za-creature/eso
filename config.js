export const SEGMENT_LENGTH = 5 // length of a transcoded video segment (seconds)
export const PROFILES = [
    // please keep this list in ascending order of quality
    [ 320,  180, 15,  256, 1, 1],
    [ 480,  270, 20,  576, 2, 1],
    [ 640,  360, 30,  896, 3, 1],

    [ 768,  432, 30, 1184, 3, 2],
    [ 848,  480, 30, 1504, 3, 2],
    [1024,  576, 30, 1824, 4, 2],

    [1280,  720, 30, 2144, 4, 2],
    [1920, 1080, 30, 2464, 5, 2]
    // width, height, framerate, h264 bitrate, aac quality (1-5), channels (<3)
]


// maps audio quality and channel count to expected average aac bitrate
// current implementation can only downmix to mono or stereo, no 5.1 output
// don't change this unless you know what you're doing
// https://en.wikipedia.org/wiki/Fraunhofer_FDK_AAC
export const AUDIO_BITRATES = [
    [32, 40, 56, 72, 112],  // mono
    [40, 64, 96, 128, 192]  // stereo
]


// eso can transcode to multiple output bitrates in a single pass (batch)

// because the process is memory intensive (in addition to encoder memory
// usage, all transcoded segments are stored to ramdisk until the ffmpeg
// subprocess returns), this parameter can be used to configure the
// maximum total output bitrate per batch, thus somewhat limiting memory
// usage at the expense of slightly more overall cpu usage (the decoder runs
// one time per batch) and total latency (this can be removed, but it would
// require either pubsub or even more creative use of the input bucket)
export const BATCH_MAXRATE = 7000 // total (audio + video) kilobits per second
