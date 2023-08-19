#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const fs_1 = require("fs");
const yargs = require("yargs");
yargs
    .usage('$0 [OPTION]... <FILE>')
    .option('in-place', {
    alias: 'i',
    type: 'boolean',
    description: 'edit file in place'
})
    .alias('help', 'h')
    .example('stdout', 'mdp README.md')
    .example('in-place', 'mdp -i README.md')
    .example('pipe', 'cat README.md | mdp')
    .check(argv => {
    if (argv._.length === 0 && argv.i) {
        throw new Error('File not specified, cannot edit in place');
    }
    return true;
});
const inputFile = yargs.argv._[0] || 0; // default to STDIN
const input = (0, fs_1.readFileSync)(inputFile, 'utf-8');
const output = (0, index_1.padMarkdown)(input);
if (yargs.argv.i) {
    (0, fs_1.writeFileSync)(inputFile, output);
}
else {
    process.stdout.write(output);
}