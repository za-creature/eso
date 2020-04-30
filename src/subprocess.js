import {spawn} from 'child_process'
import readline from 'readline'


export default function call(bin, args=[], opts={}) {
    // call process with stderr buffering
    opts.stdio = opts.stdio || ['ignore', 'ignore', 'ignore']
    opts.stdio[2] = 'pipe'

    console.log(`Running ${bin} with ${JSON.stringify(args)}`)
    let proc = spawn(bin, args, opts)
    
    // readline interface into reads / lines
    let reads = [], ri = 0
    let lines = [], li = 0
    let rl = readline.createInterface({input: proc.stderr})
    proc.line = () => new Promise((res) => {
        if(lines.length > li)
            res(lines[li++])
        else if(rl)
            reads.push(res)
        else // eof
            res(null)
    })
    rl.on('line', line => {
        if(reads.length > ri)
            reads[ri++](line)
        else
            lines.push(line)
    })
    rl.on('close', () => {
        rl = null
        while(reads.length > ri)
            reads[ri++](null) // eof all pending reads
    })

    // promisify & add cancellation support
    let promise = Object.assign(new Promise((res, rej) => proc.on('exit', (code, signal) => {
        proc = null
        if(rl)
            rl.close()
        if(code || signal) {
            console.log(lines.join('\n'))
            if(code)
                rej(new Error(`Non-zero exit code ${code}`))
            else
                rej(new Error(`Killed by signal ${signal}`))
        }
        else
            res()
    })), proc)
    promise.kill = signal => (proc && proc.kill(signal), promise.catch(() => {}))
    return promise
}
