import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { finishStream, randomNumberOfLength } from './utils';
import * as unzip from 'unzipper';

export class Installer {
    /**
     * Install the archive at the given URL into the `build` folder.
     * @param url 
     * @param filename 
     */
    async installArchive(url: string, buildFolder: string): Promise<boolean> {
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
}