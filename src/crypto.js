import {createHmac, createHash} from 'crypto'
import {private_key} from '../gcloud.json'

import {deflateSync, inflateSync} from 'zlib'


const KEY = process.env.SECRET || createHash('sha256').update(private_key).digest()
let hmac = str => createHmac('sha256', KEY).update(str).digest('base64')


export function sign(obj) {
    let serial = deflateSync(Buffer.from(JSON.stringify(obj), 'utf-8')).toString('base64')
    let signature = hmac(serial)
    return serial + '.' + signature
}


export function verify(str) {
    let [serial, signature] = str.split('.', 2)
    if(hmac(serial) != signature)
        throw new EvalError('Signature mismatch')
    return JSON.parse(inflateSync(Buffer.from(serial, 'base64')).toString('utf-8'))
}
