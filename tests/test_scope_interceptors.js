var nmock = require('../');
var test = require('tap').test;

test('scope exposes interceptors', function(t) {
  nmock.load(__dirname  + '/fixtures/goodRequest.json').forEach(function (scope) {
    scope.interceptors.forEach(function(interceptor) {
      interceptor.delayConnection(100);
    });
  });
  t.end();
});
