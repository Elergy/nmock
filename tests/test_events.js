'use strict';

var nmock = require('../.');
var http = require('http');
var test = require('tap').test;

test('emits request and replied events', function(t) {
  var scope = nmock('http://eventland')
        .get('/please')
        .reply(200);

  scope.on('request', function(req, interceptor) {
    t.equal(req.path, '/please');
    t.equal(interceptor.interceptionCounter, 0);
    scope.on('replied', function(req, interceptor) {
      t.equal(req.path, '/please');
      t.equal(interceptor.interceptionCounter, 1);
      t.end();
    });
  });

  var req = http.get('http://eventland/please');
});

test('emits no match when no match and no mock', function(t) {
  nmock.emitter.once('no match', function(req) {
    t.end();
  });

  var req = http.get('http://doesnotexistandneverexistedbefore/abc');
  req.once('error', ignore);
});

test('emits no match when no match and mocked', function(t) {

  nmock('http://itmayormaynotexistidontknowreally')
    .get('/')
    .reply('howdy');


  var assertion = function(req) {
    t.equal(req.path, '/definitelymaybe');
    nmock.emitter.removeAllListeners('no match');
    t.end();
  }
  var result = nmock.emitter.on('no match', assertion);

  http.get('http://itmayormaynotexistidontknowreally/definitelymaybe')
    .once('error', ignore);
});

test('emits no match when netConnect is disabled', function(t) {
  nmock.disableNetConnect();
  nmock.emitter.on('no match', function(req) {
    t.equal(req.hostname, 'twitter.com')
    nmock.emitter.removeAllListeners('no match');
    nmock.enableNetConnect();
    t.end();
  });
  http.get('http://twitter.com').once('error', ignore);
});

function ignore() {}
