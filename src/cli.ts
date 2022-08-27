#!/usr/bin/env node

import "@alterior/platform-nodejs";
import { CommandLine } from "@alterior/command-line";
import * as commands from "./commands";

let line = new CommandLine()
    .info({
        executable: 'twine',
        description: 'A tool for distributing prebuilt binaries for Node.js native addons',
        copyright: 'Copyright 2022 Astronaut Labs, LLC',
        version: require('../package.json').version
    })
;

Object.keys(commands)
    .map(cmd => <typeof commands.install>commands[cmd])
    .forEach(cmd => line.command(cmd.name, defn => {
        defn.info(cmd.info);
        cmd.options?.forEach(opt => defn.option(opt));
        defn.run(args => cmd(args, defn));
    }))
;

line.run(_ => line.showHelp())
    .process();