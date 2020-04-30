import {convert_segment, split_into_segments} from './media'

import fs from 'fs'


const ramdisk = fs.promises.mkdir(process.env.RAMDISK, {recursive: true})
export default async function eso(file) {
    await ramdisk  // ensure ramdisk is ready
    try {
        if(file.metadata && file.metadata.eso) {
            let pos = file.name.lastIndexOf('/')
            await convert_segment(file.name.substring(0, pos),
                                  file.name.substring(pos+1).replace('.ts', ''),
                                  file.metadata.eso)
        } else
            await split_into_segments(file.name)
    } finally { // ensure ramdisk is clean
        await Promise.all((await fs.promises.readdir(process.env.RAMDISK)).map(
            file => (
                console.warn(`Deleting dangling file ${file} from ramdisk`),
                fs.promises.unlink(process.env.RAMDISK + file).catch(() => {})
            )
        ))
    }
}
