# eso
A horizontally scalable high-throughput near-realtime multirate h264 & aac
encoding engine built on top of [ffmpeg](http://ffmpeg.org/) and
[google cloud](https://cloud.google.com) with a sprinkle of
[AWS](https://aws.amazon.com/dynamodb/). Produces adaptive bitrate MPEG-TS
fragments suitable for use with a video player that supports HLS


## Live demo
link


## Installation


### Prerequisites
* a google cloud account with
  [Functions](https://cloud.google.com/functions) enabled and two empty storage
  [Bucket](https://cloud.google.com/storage)s
* an amazon web services account with an empty DynamoDB table (optional)
* [`docker`](https://www.docker.com/) or a precompiled ffmpeg binary that is
  compatible with (practically statically linked against) google's Node.js 10
  [cloud functions runtime](https://cloud.google.com/functions/docs/concepts/exec)
* [`gcloud`](https://cloud.google.com/sdk/install)
* [`make`](https://www.gnu.org/software/make/)


### Building
Edit `.env.sample` accordingly and then rename it to `.env`:
```sh
mv .env.sample .env
```

Copy your own `ffmpeg` binary to the `bin/` directory **or** run
(requires docker)
```sh
make
```

(Optional) configure your preferred multimedia settings in `config.js`


### Deploying
[Create a service key](https://cloud.google.com/iam/docs/creating-managing-service-account-keys)
and save it to `gcloud.json`

Authenticate into google cloud SDK and set your default project ID:
```sh
gcloud auth activate-service-account --key-file=gcloud.json
gcloud config set project $(sed '/project_id/!d;s/.*"\(.*\)",/\1/' gcloud.json)
```

Run
```sh
make deploy
```

## Usage
Once successfully deployed, eso will attempt to transcode any files uploaded to
the input bucket into the configured output bucket (publicly accessible).
Conversion status updates are sent to dynamodb if configured, with the following
schema:
```js
{
    key: String, // the key (filename) in the input bucket
    total_segments: Number, // total number of segments or -1 on fatal error
    ready_segments: Set, // a set of already transcoded segments
    thumb: Boolean // whether the video file has a thumbnail
}
```

A `key` is ready for on-demand seekable playback after
`segments_ready.size == total_segments`, and a progress indicator may be
estimated linearly from the former condition. All files transcoded from a key
in the input bucket are stored in the output bucket using the input `key` as
prefix. The exact mapping is:

```js
(key) => `${key}/index.m3u8`  // master playlist (output video url)
(key) => `${key}/thumb.jpeg`  // thumbnail extracted from first video segment
(key, bandwidth) => `${key}/${bandwidth}k/index.m3u8` // profile playlist
(key, bandwidth, segment) => `${key}/${bandwidth}k/${segment}.ts` // ts segment
```

Where `bandwidth` is the estimated audio + video bitrate in kilobits per second,
and `segment` is a monotonically increasing number between 0 and
`floor(stream_duration / segment_duration)` (see `config.js`).

Non-seekable playback may be attempted as soon as the first few transcoded
segments are uploaded, though continuous playback is not guaranteed in this
scenario as it depends on many factors including player software, cloud function
scheduling and input / output video complexity.


## Limitations
* can only split segments at an
  [I-frame](https://en.wikipedia.org/wiki/Video_compression_picture_types)
  boundary; this means that some videos will scale (latency-wise) better than
  others and a DoS attack is possible in the current implementation
* video output is limited by what
  [x264](https://www.videolan.org/developers/x264.html) can support
* audio output is limited to AAC HE, mono and stereo
* since a cloud function can only run for at most 9 minutes, the practical limit
  for the size of an input file is around 30GiB (assumes 1Gbps network) and
  about 50 profiles, depending on complexity and segment length


## Gotchas
* for ease of deployment, eso makes liberal use of the word `input` as it also
  requires write access to the input bucket to cloud-fork itself by uploading
  intermediary video segments with custom metadata. These segments are deleted
  once successfully transcoded, however in order to deal with dangling
  references in case of failure, I strongly recommend configuring adequate
  [lifecycle management](https://cloud.google.com/storage/docs/lifecycle)
  policies on the input bucket
* the profiles configured in `config.js` are treated as maximum values;
  depending on the quality of your input files, some profiles may be encoded
  with lower quality settings or omitted altogether
* the meta entry is created before splitting the input file, and at that time
  it is only guaranteed to contain the `thumb` field; `segments` is created
  after the file has been split into segments and the `ready` field is only
  created after the first segment has been successfully transcoded
* if you're redeploying after updating `gcloud.json`, all pending transcode
  operations will fail because the hashed private key is used to sign segment
  uploads; to avoid this, add `SECRET=some_random_secret_string_here` to `.env`
  and it will be used as a HMAC key instead, though if you're reading this after
  you're already live, tough luck


## License: MIT
This is a tech demo, and while functional, I wouldn't call it production ready.
Reusing code from this repository is fine by me, but the generated binaries are
not redistributable and some codecs may be protected by patents as well. Always
double-check with your legal team before deploying multimedia transcoding
technologies for commercial purposes. And write some tests!
