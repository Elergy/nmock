var http = require('http');
var nmock = require('../');
var log = require('./_log');
var events = ['socket', 'response', 'end', 'data', 'timeout', 'error'];

nmock('http://delayconnection.com').
  get('/').
  socketDelay(2000).
  reply(200, 'hey');

var req = http.get('http://delayconnection.com', function(res) {
  events.forEach(log(res, 'res'));
});

req.setTimeout(1000, function() {
  req.abort();
});

events.forEach(log(req, 'req'));