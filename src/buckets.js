import {Storage} from '@google-cloud/storage'


let gcs = new Storage()
export let input = gcs.bucket(process.env.INPUT_BUCKET)
export let output = gcs.bucket(process.env.OUTPUT_BUCKET)
