import AWS from 'aws-sdk'


let db
let noop = process.env.META_TABLE ? null : new Promise(res => res())
export default function update_metadata(key, props) {
    if(noop)
        return noop

    props.TableName = process.env.META_TABLE
    props.Key = {key: {S: '' + key}}
    return new Promise((res, rej) => {
        if(!db) {
            AWS.config.update({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION
            })
            db = new AWS.DynamoDB()
        }
        db.updateItem(props, (err, data) => {
            if(err)
                return rej(err)
            res(data)
        })
    }).catch(err => {
        if(err.code == 'ConditionalCheckFailedException')
            console.warn(`Conditional update failed for ${key}`)
        else
            throw err
    })
}
