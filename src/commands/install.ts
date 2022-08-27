import path from 'path';
import { download, fileExists, finishStream, npmRun } from '../utils';
import * as unzip from 'unzipper';
import * as fs from 'fs';
import { Command, CommandInfo, CommandLineOption } from '@alterior/command-line';

export async function install(args: string[], defn: Command) {
    if (process.cwd() === process.env.INIT_CWD && !defn.option('allow-dev').present) {
        console.log(`twine: Not installing artifact during development install (--allow-dev to bypass this check)`);
        return;
    }

    let pkg = require(path.join(process.cwd(), 'package.json'));
    let buildDir = path.join(process.cwd(), 'build');
    let buildType = process.env.DEBUG === '1' ? 'Debug' : 'Release';
    let variantName = `${pkg.name}@${pkg.version}.${process.platform}-${process.arch}-${buildType}.zip`;
    let url = `${pkg.twine.distributionUrl}/${variantName}`;
    let buildTypeDir = path.join(buildDir, buildType);
    let binaryFile = path.join(buildTypeDir, `${pkg.twine.moduleName}.node`);
    let twineDir = path.join(process.cwd(), '.twine');
    let localArchive = path.join(twineDir, variantName);

    if (await fileExists(binaryFile)) {
        console.info(`twine: Binary already exists at ${binaryFile}`);
        return;
    }

    if (await fileExists(localArchive)) {
        await finishStream(fs.createReadStream(localArchive).pipe(unzip.Extract({ path: buildTypeDir })));
        return;
    }

    if (!pkg.twine.packOnly) {
        try {
            await finishStream((await download(url)).pipe(unzip.Extract({ path: buildTypeDir })));
            return true;
        } catch (e) {
            console.error(`Error: ${e}`);
        }
    }

    console.info(`Unable to download a prebuilt binary. Building locally...`);
    try {
        await npmRun('build:native');
    } catch (code) {
        console.error(`twine: Build failed: (code ${code})`);
        process.exit(code);
    }
}

install.info = <CommandInfo>{
    description: 'Locate a compatible artifact locally or remotely. Build from source if an artifact is not available'
};

install.options = <CommandLineOption[]>[
    {
        id: 'allow-dev',
        short: 'D',
        description: `Install from artifacts even when running 'npm install' during development`
    }
];