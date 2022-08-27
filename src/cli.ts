#!/usr/bin/env node

import "@alterior/platform-nodejs";
import { CommandLine } from "@alterior/command-line";
import { install } from "./install";
import { upload } from "./upload";

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
            .run(() => upload())
        ;
    })
    .command('install', cmd => {
        cmd .info({
                description: 'Download and install a compatible binary or build from source if needed'
            })
            .run(args => install(args))
        ;
    })
    .run(_ => line.showHelp());
;

line.process();