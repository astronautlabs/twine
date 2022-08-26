import { Command, CommandLine } from "@alterior/command-line";

const PKG = require('../package.json');

let line = new CommandLine()
    .info({
        executable: 'twine',
        description: 'A tool for distributing prebuilt binaries for Node.js native addons',
        copyright: 'Copyright 2022 Astronaut Labs, LLC',
        version: PKG.version
    })
    .command('upload', cmd => {
        cmd .info({
                description: 'Upload a binary',
                argumentUsage: '[--debug] <variant-name>'
            })
            .run(async args => {

            })
        ;
    })
    .command('download', cmd => {
        cmd .info({
                description: 'Download a binary',
                argumentUsage: '<variant-name>'
            })
            .run(async args => {

            })
        ;
    })
    .run(args => line.showHelp());
;

line.process();