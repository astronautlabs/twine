import path from 'path';
import { Readable } from 'stream';
import { fileExists, finishStream } from './utils';
import * as unzip from 'unzipper';
import * as childProcess from "child_process";

export async function install(args: string[]) {
    let pkg = require(path.join(process.cwd(), 'package.json'));
    let buildDir = path.join(process.cwd(), 'build');
    let buildType = process.env.DEBUG === '1' ? 'Debug' : 'Release';
    let variantName = `${pkg.name}@${pkg.version}.${process.platform}-${process.arch}-${buildType}.tgz`;
    let url = `${pkg.twine.distributionUrl}/${variantName}`;
    let buildTypeDir = path.join(buildDir, buildType);
    let binaryFile = path.join(buildTypeDir, `${pkg.twine.moduleName}.node`);

    if (await fileExists(binaryFile)) {
        console.info(`twine: Binary already exists at ${binaryFile}`);
        return;
    }

    if (!await installArchive(url, buildTypeDir)) {
        console.info(`Unable to download a prebuilt binary. Building locally...`);
        // Build
        await new Promise<void>((resolve, reject) => {
            let proc = childProcess.spawn(
                /^win/.test(process.platform) ? 'npm.cmd' : 'npm', 
                ['run', 'build:native'], 
                { stdio: 'inherit' }
            );

            proc.addListener('exit', (code, signal) => {
                if (code !== 0) {
                    console.error(`twine: Build command failed (code ${code})`);
                    reject();
                    return;
                }

                resolve();
            });
        });
    }
}

/**
 * Install the archive at the given URL into the `build` folder.
 * @param url 
 * @param filename 
 */
export async function installArchive(url: string, buildFolder: string): Promise<boolean> {
    console.log(`Downloading ${url}`);
    console.log(`   extracting to:  ${buildFolder}`);

    let response: Response;
    
    try {
        response = await fetch(url);
    } catch (e) {
        console.error(`Error: ${e.message}`);
        return false;
    }

    if (response.status !== 200) {
        console.error(`Error: Received unexpected HTTP status ${response.status} while downloading ${url}`);
        return false;
    }

    console.info(`Success! Extracting archive to ${buildFolder}...`);
    await finishStream((response.body as unknown as Readable).pipe(unzip.Extract({ path: buildFolder })));
    return true;
}