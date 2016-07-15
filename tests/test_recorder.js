'use strict';

var nmock    = require('../.')
  , tap     = require('tap')
  , http    = require('http')
  , https   = require('https')
  , _       = require('lodash')
  , debug   = require('debug')('nmock.test_recorder')
  , mikealRequest = require('request')
  , superagent = require('superagent')
  , rest = require('restler');

var globalCount;

tap.test("setup", function(t) {
  globalCount = Object.keys(global).length;
  t.end();
});

tap.test('recording turns off nmock interception (backward compatibility behavior)', function(t) {

  //  We ensure that there are no overrides.
  nmock.restore();
  t.false(nmock.isActive());
  //  We active the nmock overriding - as it's done by merely loading nmock.
  nmock.activate();
  t.true(nmock.isActive());
  //  We start recording.
  nmock.recorder.rec();
  //  Nothing happens (nothing has been thrown) - which was the original behavior -
  //  and mocking has been deactivated.
  t.false(nmock.isActive());

  t.end();

});

tap.test('records', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);
  var options = { method: 'POST'
                , host:'google.com'
                , port:80
                , path:'/' }
  ;

  nmock.recorder.rec(true);
  var req = http.request(options, function(res) {
    res.resume();
    var ret;
    res.once('end', function() {
      nmock.restore();
      ret = nmock.recorder.play();
      t.equal(ret.length, 1);
      t.type(ret[0], 'string');
      t.equal(ret[0].indexOf("\nnmock('http://google.com:80', {\"encodedQueryParams\":true})\n  .post('/', \"ABCDEF\")\n  .reply("), 0);
      t.end();
    });
  });
  req.end('ABCDEF');
});

tap.test('records objects', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);
  var options = { method: 'POST'
                , host:'google.com'
                , path:'/' }
  ;

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });
  var req = http.request(options, function(res) {
    res.resume();
    res.once('end', function() {
      nmock.restore();
      var ret = nmock.recorder.play();
      t.equal(ret.length, 1);
      ret = ret[0];
      t.type(ret, 'object');
      t.equal(ret.scope, "http://google.com:80");
      t.equal(ret.method, "POST");
      t.ok(typeof(ret.status) !== 'undefined');
      t.ok(typeof(ret.response) !== 'undefined');
      t.end();
    });
  });
  req.end('012345');
});

tap.test('records and replays objects correctly', function(t) {

  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var makeRequest = function(callback) {
    superagent
      .get('http://google.com')
      .end(callback);
  };

  makeRequest(function(err, resp) {

    t.ok(!err);
    t.ok(resp);
    t.ok(resp.headers);

    nmock.restore();
    var nmockDefs = nmock.recorder.play();
    nmock.recorder.clear();
    nmock.activate();

    t.equal(nmockDefs.length, 2);
    var nmocks = nmock.define(nmockDefs);

    makeRequest(function(mockedErr, mockedResp) {

      t.equal(err, mockedErr);
      t.deepEqual(mockedResp.body, resp.body);

      _.each(nmocks, function(nmock) {
        nmock.done();
      });

      t.end();

    });
  });

});

tap.test('records and replays correctly with filteringRequestBody', function(t) {

  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var makeRequest = function(callback) {
    superagent
      .get('http://google.com')
      .end(callback);
  };

  makeRequest(function(err, resp) {

    t.ok(!err);
    t.ok(resp);
    t.ok(resp.headers);

    nmock.restore();
    var nmockDefs = nmock.recorder.play();
    nmock.recorder.clear();
    nmock.activate();

    t.equal(nmockDefs.length, 2);
    var nmockDef = _.first(nmockDefs);
    var filteringRequestBodyCounter = 0;
    nmockDef.filteringRequestBody = function(body, aRecodedBody) {
      ++filteringRequestBodyCounter;
      t.strictEqual(body, aRecodedBody);
      return body;
    };
    var nmocks = nmock.define(nmockDefs);

    makeRequest(function(mockedErr, mockedResp) {

      t.equal(err, mockedErr);
      t.deepEqual(mockedResp.body, resp.body);

      _.each(nmocks, function(nmock) {
        nmock.done();
      });

      t.strictEqual(filteringRequestBodyCounter, 1);
      t.end();

    });
  });

});

tap.test('checks if callback is specified', function(t) {
  var options = {
    host: 'www.google.com', method: 'GET', path: '/', port: 80
  };

  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);
  nmock.recorder.rec(true);

  http.request(options).end();
  t.end();
});

tap.test('when request body is json, it goes unstringified', function(t) {
  var payload = {a: 1, b: true};
  var options = {
    method: 'POST',
    host: 'www.google.com',
    path: '/',
    port: 80
  };

  nmock.restore();
  nmock.recorder.clear();
  nmock.recorder.rec(true);

  var request = http.request(options, function(res) {
    res.resume();
    res.once('end', function() {
      var ret = nmock.recorder.play();
      t.ok(ret.length >= 1);
      ret = ret[1] || ret[0];
      t.equal(ret.indexOf("\nnmock('http://www.google.com:80', {\"encodedQueryParams\":true})\n  .post('/', {\"a\":1,\"b\":true})\n  .reply("), 0);
      t.end();
    });
  });

  request.end(JSON.stringify(payload));
});

tap.test('when request body is json, it goes unstringified in objects', function(t) {
  var payload = {a: 1, b: true};
  var options = {
    method: 'POST',
    host: 'www.google.com',
    path: '/',
    port: 80
  };

  nmock.restore();
  nmock.recorder.clear();
  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var request = http.request(options, function(res) {
    res.resume();
    res.once('end', function() {
      var ret = nmock.recorder.play();
      t.ok(ret.length >= 1);
      ret = ret[1] || ret[0];
      t.type(ret, 'object');
      t.equal(ret.scope, "http://www.google.com:80");
      t.equal(ret.method, "POST");
      t.ok(ret.body && ret.body.a && ret.body.a === payload.a && ret.body.b && ret.body.b === payload.b);
      t.ok(typeof(ret.status) !== 'undefined');
      t.ok(typeof(ret.response) !== 'undefined');
      t.end();
    });
  });

  request.end(JSON.stringify(payload));
});

tap.test('records nonstandard ports', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  var REQUEST_BODY = 'ABCDEF';
  var RESPONSE_BODY = '012345';

  //  Create test http server and perform the tests while it's up.
  var testServer = http.createServer(function(req, res) {
    res.write(RESPONSE_BODY);
    res.end();
  }).listen(8081, function(err) {

    t.equal(err, undefined);

    var options = { host:'localhost'
                  , port:testServer.address().port
                  , path:'/' }
    ;

    var rec_options = {
      dont_print: true,
      output_objects: true
    };

    nmock.recorder.rec(rec_options);

    var req = http.request(options, function(res) {
      res.resume();
      res.once('end', function() {
        nmock.restore();
        var ret = nmock.recorder.play();
        t.equal(ret.length, 1);
        ret = ret[0];
        t.type(ret, 'object');
        t.equal(ret.scope, "http://localhost:" + options.port);
        t.equal(ret.method, "GET");
        t.equal(ret.body, REQUEST_BODY);
        t.equal(ret.status, 200);
        t.equal(ret.response, RESPONSE_BODY);
        t.end();

        //  Close the test server, we are done with it.
        testServer.close();
      });
    });

    req.end(REQUEST_BODY);
  });

});

tap.test('rec() throws when reenvoked with already recorder requests', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec();
  try {
    nmock.recorder.rec();
    //  This line should never be reached.
    t.ok(false);
    t.end();
  } catch(e) {
    t.equal(e.toString(), 'Error: NMock recording already in progress');
    t.end();
  }
});

tap.test('records https correctly', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  var options = { method: 'POST'
                , host:'google.com'
                , path:'/' }
  ;

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var req = https.request(options, function(res) {
    res.resume();
    var ret;
    res.once('end', function() {
      nmock.restore();
      ret = nmock.recorder.play();
      t.equal(ret.length, 1);
      ret = ret[0];
      t.type(ret, 'object');
      t.equal(ret.scope, "https://google.com:443");
      t.equal(ret.method, "POST");
      t.ok(typeof(ret.status) !== 'undefined');
      t.ok(typeof(ret.response) !== 'undefined');
      t.end();
    });
  });
  req.end('012345');
});

tap.test('records request headers correctly', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true,
    enable_reqheaders_recording: true
  });

  var req = http.request({
      hostname: 'www.example.com',
      path: '/',
      method: 'GET',
      auth: 'foo:bar'
    }, function(res) {
      res.resume();
      res.once('end', function() {
        nmock.restore();
        var ret = nmock.recorder.play();
        t.equal(ret.length, 1);
        ret = ret[0];
        t.type(ret, 'object');
        t.equivalent(ret.reqheaders, {
          host: 'www.example.com',
          'authorization': 'Basic Zm9vOmJhcg=='
        });
        t.end();
      });
    }
  );
  req.end();
});

tap.test('records and replays gzipped nmocks correctly', function(t) {

  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var makeRequest = function(callback) {
    superagent.get('https://bit.ly/1hKHiTe', callback);
  };

  makeRequest(function(err, resp) {

    t.ok(!err);
    t.ok(resp);
    t.ok(resp.headers);
    t.equal(resp.headers['content-encoding'], 'gzip');

    nmock.restore();
    var nmockDefs = nmock.recorder.play();
    nmock.recorder.clear();
    nmock.activate();

    // Original bit.ly request is redirected to the target page.
    t.true(nmockDefs.length > 1);
    var nmocks = nmock.define(nmockDefs);

    makeRequest(function(mockedErr, mockedResp) {

      t.equal(err, mockedErr);
      t.deepEqual(mockedResp.body, resp.body);
      t.equal(mockedResp.headers['content-encoding'], 'gzip');

      _.each(nmocks, function(nmock) {
        nmock.done();
      });

      t.end();

    });
  });

});

tap.test('records and replays gzipped nmocks correctly when gzip is returned as a string', function(t) {

  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var makeRequest = function(callback) {
    rest.get('http://bit.ly/1hKHiTe', {'headers':{'Accept-Encoding':'gzip'}})
      .on('fail', function(data, response){
        t.ok(false);
        t.end();
      })
      .on('error', function(error, response) {
        t.ok(false);
        t.end();
      })
      .on('success', callback);
  };

  makeRequest(function(err, resp) {

    t.ok(resp);
    t.ok(resp.headers);
    t.equal(resp.headers['content-encoding'], 'gzip');

    nmock.restore();
    var nmockDefs = nmock.recorder.play();
    nmock.recorder.clear();
    nmock.activate();

    // Original bit.ly request is redirected to the target page.
    t.true(nmockDefs.length > 1);
    var nmocks = nmock.define(nmockDefs);

    makeRequest(function(mockedErr, mockedResp) {

      t.equal(err, mockedErr);
      t.deepEqual(mockedResp.body, resp.body);
      t.equal(mockedResp.headers['content-encoding'], 'gzip');

      _.each(nmocks, function(nmock) {
        nmock.done();
      });

      t.end();

    });
  });

});

tap.test('records and replays nmocks correctly', function(t) {

  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var makeRequest = function(callback) {

    var options = {
      method: 'GET',
      uri: 'http://bit.ly/1hKHiTe',
    };

    mikealRequest(options, callback);

  };

  makeRequest(function(err, resp, body) {

    t.ok(!err);
    t.ok(resp);
    t.ok(body);

    nmock.restore();
    var nmockDefs = nmock.recorder.play();
    nmock.recorder.clear();
    nmock.activate();

    // Original bit.ly request is redirected to the target page.
    t.true(nmockDefs.length > 1);
    var nmocks = nmock.define(nmockDefs);

    makeRequest(function(mockedErr, mockedResp, mockedBody) {

      t.equal(err, mockedErr);
      t.equal(body, mockedBody);

      _.each(nmocks, function(nmock) {
        nmock.done();
      });

      t.end();

    });
  });

});

tap.test('doesn\'t record request headers by default', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var req = http.request({
      hostname: 'www.example.com',
      path: '/',
      method: 'GET',
      auth: 'foo:bar'
    }, function(res) {
      res.resume();
      res.once('end', function() {
        nmock.restore();
        var ret = nmock.recorder.play();
        t.equal(ret.length, 1);
        ret = ret[0];
        t.type(ret, 'object');
        t.false(ret.reqheaders);
        t.end();
      });
    }
  );
  req.end();
});


tap.test('will call a custom logging function', function(t) {
  // This also tests that use_separator is on by default.
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  var record = [];
  var arrayLog = function(content) {
    record.push(content);
  }

  nmock.recorder.rec({
    logging: arrayLog
  });

  var req = http.request({
      hostname: 'www.example.com',
      path: '/',
      method: 'GET',
      auth: 'foo:bar'
    }, function(res) {
      res.resume();
      res.once('end', function() {
        nmock.restore();

        t.equal(record.length, 1)
        var ret = record[0]
        t.type(ret, 'string');
        t.end();
      });
    }
  );
  req.end();
});


tap.test('use_separator:false is respected', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  var record = [];
  var arrayLog = function(content) {
    record.push(content);
  }

  nmock.recorder.rec({
    logging: arrayLog,
    output_objects: true,
    use_separator: false,
  });

  var req = http.request({
      hostname: 'www.example.com',
      path: '/',
      method: 'GET',
      auth: 'foo:bar'
    }, function(res) {
      res.resume();
      res.once('end', function() {
        nmock.restore();
        t.equal(record.length, 1)
        var ret = record[0];
        t.type(ret, 'object'); // this is still an object, because the "cut here" strings have not been appended
        t.end();
      });
    }
  );
  req.end();
});


tap.test('records request headers except user-agent if enable_reqheaders_recording is set to true', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true,
    enable_reqheaders_recording: true
  });

  var req = http.request({
      hostname: 'www.example.com',
      path: '/',
      method: 'GET',
      auth: 'foo:bar'
    }, function(res) {
      res.resume();
      res.once('end', function() {
        nmock.restore();
        var ret = nmock.recorder.play();
        t.equal(ret.length, 1);
        ret = ret[0];
        t.type(ret, 'object');
        t.true(ret.reqheaders);
        t.false(ret.reqheaders['user-agent']);
        t.end();
      });
    }
  );
  req.end();
});

tap.test('includes query parameters from superagent', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  superagent.get('http://google.com')
    .query({q: 'test search' })
    .end(function(res) {
      nmock.restore();
      var ret = nmock.recorder.play();
      t.true(ret.length >= 1);
      t.equal(ret[0].path, '/?q=test%20search');
      t.end();
    });
});

tap.test('works with clients listening for readable', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  var REQUEST_BODY = 'ABCDEF';
  var RESPONSE_BODY = '012345';

  //  Create test http server and perform the tests while it's up.
  var testServer = http.createServer(function(req, res) {
    res.write(RESPONSE_BODY);
    res.end();
  }).listen(8081, function(err) {

    // t.equal(err, undefined);

    var options = { host:'localhost'
                  , port:testServer.address().port
                  , path:'/' }
    ;

    var rec_options = {
      dont_print: true,
      output_objects: true
    };

    nmock.recorder.rec(rec_options);

    var req = http.request(options, function(res) {
      var readableCount = 0;
      var chunkCount = 0;
      res.on('readable', function() {
        ++readableCount;
        var chunk;
        while (null !== (chunk = res.read())) {
          t.equal(chunk.toString(), RESPONSE_BODY);
          ++chunkCount;
        }
      });
      res.once('end', function() {
        nmock.restore();
        var ret = nmock.recorder.play();
        t.equal(ret.length, 1);
        ret = ret[0];
        t.type(ret, 'object');
        t.equal(readableCount, 1);
        t.equal(chunkCount, 1);
        t.equal(ret.scope, "http://localhost:" + options.port);
        t.equal(ret.method, "GET");
        t.equal(ret.body, REQUEST_BODY);
        t.equal(ret.status, 200);
        t.equal(ret.response, RESPONSE_BODY);
        t.end();

        //  Close the test server, we are done with it.
        testServer.close();
      });
    });

    req.end(REQUEST_BODY);
  });

});

tap.test('outputs query string parameters using query()', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);

  nmock.recorder.rec(true);

  var makeRequest = function(callback) {
    superagent
      .get('https://example.com/')
      .query({'param1':1,'param2':2})
      .end(callback);
  };

  makeRequest(function(err, resp) {
    t.ok(!err, err && err.message || 'no error');
    t.ok(resp, 'have response');
    t.ok(resp.headers, 'have headers');

    var ret = nmock.recorder.play();
    t.equal(ret.length, 1);
    t.type(ret[0], 'string');
    var match = "\nnmock('https://example.com:443', {\"encodedQueryParams\":true})\n  .get('/')\n  .query({\"param1\":\"1\",\"param2\":\"2\"})\n  .reply(";
    t.equal(ret[0].substring(0, match.length), match);
    t.end();
  });
});

tap.test('removes query params from from that path and puts them in query()', function(t) {
  nmock.restore();
  nmock.recorder.clear();
  t.equal(nmock.recorder.play().length, 0);
  var options = { method: 'POST'
                , host:'google.com'
                , port:80
                , path:'/?param1=1&param2=2' }
  ;

  nmock.recorder.rec(true);
  var req = http.request(options, function(res) {
    res.resume();
    var ret;
    res.once('end', function() {
      nmock.restore();
      ret = nmock.recorder.play();
      t.equal(ret.length, 1);
      t.type(ret[0], 'string');
      t.equal(ret[0].indexOf("\nnmock('http://google.com:80', {\"encodedQueryParams\":true})\n  .post('/', \"ABCDEF\")\n  .query({\"param1\":\"1\",\"param2\":\"2\"})\n  .reply("), 0);
      t.end();
    });
  });
  req.end('ABCDEF');
});

tap.test("respects http.request() consumers", function(t) {
  //  Create test http server and perform the tests while it's up.
  var testServer = http.createServer(function(req, res) {
    res.write('foo');
    setTimeout(function() {
      res.end('bar');
    }, 25);
  }).listen(8082, function(err) {
    t.equal(err, undefined);

    nmock.restore();
    nmock.recorder.clear();
    nmock.recorder.rec({
      dont_print: true,
      output_objects: true
    });


    var options = { host:'localhost'
                  , port:testServer.address().port
                  , path:'/' }
    ;
    var req = http.request(options, function (res) {
      var buffer = new Buffer('');

      setTimeout(function () {
        res
          .on('data', function(data) {
            buffer = Buffer.concat([buffer, data]);
          })
          .on('end', function() {
            nmock.restore();
            t.equal(buffer.toString(), 'foobar');
            t.end();

            //  Close the test server, we are done with it.
            testServer.close();
          });
      });
    }, 50);

    req.end();
  });
});

tap.test("teardown", function(t) {
  var leaks = Object.keys(global)
    .splice(globalCount, Number.MAX_VALUE);

  if (leaks.length == 1 && leaks[0] == '_key') {
    leaks = [];
  }
  t.deepEqual(leaks, [], 'No leaks');
  t.end();
});
