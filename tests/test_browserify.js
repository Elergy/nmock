'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const browserify = require('browserify');
const Static = require('node-static');
const Browser = require('zombie');

const {test} = require('tap');
const before = test;
const after = test;

const nmock = require('../.');

nmock.enableNetConnect();

let server;

before('prepare bundle', {timeout: 10000}, (t) => {
    const browserifyInstance = browserify();
    browserifyInstance.add(path.join(__dirname, 'fixtures', 'browserify-script.js'));

    browserifyInstance
        .bundle()
        .pipe(
            fs.createWriteStream(path.join(__dirname, 'browserify-public', 'browserify-bundle.js'))
        ).once('finish', () => t.end());
});

before('start server', (t) => {
    const browserifyPublicDirectory = new Static.Server(path.join(__dirname, 'browserify-public'));
    server = http.createServer((req, res) => {
        browserifyPublicDirectory.serve(req, res);
    });

    server.listen(8080, () => t.end());
});

test('run bundle', (t) => {
    const browser = new Browser();

    browser.on('error', (err) => {
        console.error('BROWSER ERROR: ' + err.stack);
    });

    browser.visit('http://localhost:8080', () => {
        browser.assert.text('#content', 'boop');
        t.end();
    });
});

after('stop server', (t) => {
    server.close(() => t.end());
});