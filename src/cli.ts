#!/usr/bin/env node

import "@alterior/platform-nodejs";
import { Command, CommandLine } from "@alterior/command-line";
import path from "path";
import { Uploader } from "./uploader";
import { fileExists, listDirectory, randomNumberOfLength } from "./utils";
import { Installer } from "./installer";
import * as childProcess from "child_process";
import * as archiver from 'archiver';
import * as fs from 'fs';
import * as os from 'os';

const PKG = require('../package.json');

let line = new CommandLine()
    .info({
        executable: 'twine',
        description: 'A tool for distributing prebuilt binaries for Node.js native addons',
        copyright: 'Copyright 2022 Astronaut Labs, LLC',
        version: PKG.version
    })
    .command('publish', cmd => {
        cmd .info({
                description: `Publish a binary`
            })
            .run(async () => {
                let pkg = require(path.join(process.cwd(), 'package.json'));
                let buildDir = path.join(process.cwd(), 'build');
                let buildTypes = ['Release', 'Debug'];
                let binaryName = `${pkg.twine.moduleName}.node`;

                for (let buildType of buildTypes) {
                    let variantName = `${pkg.name}@${pkg.version}.${process.platform}-${process.arch}-${buildType}.tgz`;
                    let buildTypeDir = path.join(buildDir, buildType);
                    let binaryFile = path.join(buildTypeDir, binaryName);
                    if (!await fileExists(binaryFile))
                        continue;
                    
                    let stagedFile = path.join(os.tmpdir(), `twine-${randomNumberOfLength(7)}.tgz`);
                    let archive = archiver
                        .create('zip', { zlib: { level: 9 }})
                        .directory(buildTypeDir, false)
                    ;
                    archive.pipe(fs.createWriteStream(stagedFile))
                    await archive.finalize();
                        
                    let uploader = new Uploader();

                    await uploader.uploadFile(variantName, stagedFile);
                }
            })
        ;
    })
    .command('install', cmd => {
        cmd .info({
                description: 'Download and install a compatible binary or build from source if needed'
            })
            .run(async args => {
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

                if (!await new Installer().installArchive(url, buildTypeDir)) {
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
            })
        ;
    })
    .run(args => line.showHelp());
;

line.process();