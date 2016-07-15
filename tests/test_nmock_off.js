'use strict';

var test          = require('tap').test;
var mikealRequest = require('request');

test('NMOCK_OFF=true works for https', function(t) {
  var original = process.env.NMOCK_OFF;
  process.env.NMOCK_OFF = 'true';
  var nmock = require('../');
  var scope = nmock('https://www.google.com')
  .get('/')
  .reply(200, {foo: 'bar'});

  var options = {
    method: 'GET',
    uri: 'https://www.google.com'
  };

  mikealRequest(options, function(err, resp, body) {
    t.notOk(err);
    t.notDeepEqual(body, '{"foo":"bar"}');
    scope.done();
    process.env.NMOCK_OFF = original;
    t.end();
  });
});


