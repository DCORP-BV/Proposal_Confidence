#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
let truffle;

if (!/^win/.test(process.platform)) { // linux
    truffle = spawn('truffle', ['test', '--network', 'testing']);
} else { // windows
    truffle = spawn('cmd', ['/s', '/c', 'truffle', 'test', '--network', 'testing']);
}

truffle.stdout.on('data', data => {
    console.log(`${data}`);
});

truffle.stderr.on('data', data => {
    console.error(`Error: ${data}`);
});

truffle.on('close', code => {
    console.log(`Truffle closed (code ${code})`);
});