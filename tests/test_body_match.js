'use strict';

var nmock = require('../');
var test = require('tap').test;
var mikealRequest = require('request');
var assert = require('assert');

test('match body with regex', function (t) {

  nmock('http://encodingsareus.com')
    .post('/', {auth: {passwd: /a.+/}})
    .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    json: {
      auth: {
        passwd: 'abc'
      }
    },
  }, function(err, res) {
    if (err) throw err;
    assert.equal(res.statusCode, 200);
    t.end();
  });

});
