'use strict';

var test     = require('tap').test;
var nmock = require('../');
var nmockBack = nmock.back;
var http = require("http");
var rimraf = require('rimraf');
var fs = require('fs');

var originalMode;
var fixture;

function rimrafOnEnd(t) {
  t.once('end', function() {
    rimraf.sync(fixture);
  });
}

test('setup', function(t) {
  originalMode = nmockBack.currentMode;

  nmock.enableNetConnect();
  nmockBack.fixtures = __dirname + "/fixtures";
  fixture = nmockBack.fixtures + '/recording_test.json'
  rimraf.sync(fixture);

  nmockBack.setMode("record");
  t.end();
});


test('recording', function(t) {
  nmockBack('recording_test.json', function(nmockDone) {
    http.get('http://google.com', function(res) {
      res.once('end', function() {
        nmockDone();
        var fixtureContent = JSON.parse(fs.readFileSync(fixture, {encoding: 'utf8'}));
        t.equal(fixtureContent.length, 1);
        fixtureContent = fixtureContent[0];
        t.equal(fixtureContent.method, 'GET');
        t.equal(fixtureContent.path, '/');
        t.ok(fixtureContent.status == 302 || fixtureContent.status == 301);
        t.end();
      });
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume();
    });
  });

  rimrafOnEnd(t);
});

test('passes custom options to recorder', function(t) {
  nmockBack('recording_test.json', { recorder: { enable_reqheaders_recording: true } }, function(nmockDone) {
    http.get('http://google.com', function(res) {
      res.once('end', function() {
        nmockDone();
        var fixtureContent = JSON.parse(fs.readFileSync(fixture, {encoding: 'utf8'}));
        t.equal(fixtureContent.length, 1);
        fixtureContent = fixtureContent[0];
        t.ok(fixtureContent.reqheaders);
        t.end();
      });
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume();
    });
  });
  rimrafOnEnd(t);
});

test('teardown', function(t) {
  nmockBack.setMode(originalMode);
  t.end();
});
