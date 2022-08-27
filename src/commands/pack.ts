import path from 'path';
import { download, finishStream, makeDir, s3List } from "../utils";
import * as fs from 'fs';
import { CommandInfo } from '@alterior/command-line';

export async function pack(args: string[]) {
    const pkg = require(path.join(process.cwd(), 'package.json'));
    const packDir = path.join(process.cwd(), '.twine');

    let prefix = `${pkg.name}@${pkg.version}.`;
    let objects = await s3List(prefix);

    makeDir(packDir);
    for (let object of objects) {
        let stream = await download(`${pkg.twine.distributionUrl}/${object.Key}`);
        console.log(`Downloading ${object.Key}...`);
        await finishStream(stream.pipe(fs.createWriteStream(path.join(packDir, object.Key))));
    }
}

pack.info = <CommandInfo>{
    description: 'Download all artifacts for this package version and stash them into .twine for local installation'
};