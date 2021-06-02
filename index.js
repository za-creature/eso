Object.assign(process.env, {
    BABEL_CACHE_PATH: '/tmp/.babel',
    FFMPEG: __dirname + '/bin/ffmpeg',
    GOOGLE_APPLICATION_CREDENTIALS: __dirname + '/gcloud.json',
    RAMDISK: '/tmp/eso/'
})
require('dotenv').config()
require('@babel/register')
exports.eso = require('./src/eso').default
