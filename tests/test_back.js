'use strict';

var nmock    = require('../.')
  , nmockBack= nmock.back
  , tap     = require('tap')
  , http    = require('http')
  , fs      = require('fs')
  , exists  = fs.existsSync;

nmock.enableNetConnect();

var originalMode = nmockBack.currentMode;

function testNMock (t) {
  var dataCalled = false;

  var scope = nmock('http://www.google.com')
    .get('/')
    .reply(200, "Hello World!");

  var req = http.request({
      host: "www.google.com"
    , path: '/'
    , port: 80
    }, function(res) {

      t.equal(res.statusCode, 200);
      res.once('end', function() {
          t.ok(dataCalled);
          scope.done();
          t.end();
        });
      res.on('data', function(data) {
          dataCalled = true;
          t.ok(data instanceof Buffer, "data should be buffer");
          t.equal(data.toString(), "Hello World!", "response should match");
        });
    });

  req.end();
}




function nmockBackWithFixture (t, scopesLoaded) {
  var scopesLength = scopesLoaded ? 1 : 0;

  nmockBack('goodRequest.json', function (done) {
    t.true(this.scopes.length === scopesLength);
    http.get('http://www.google.com').end();
    this.assertScopesFinished();
    done();
    t.end();
  });
}

function setOriginalModeOnEnd(t, nmockBack) {
  t.once('end', function() {
    nmockBack.setMode(originalMode);
  });
}



tap.test('nmockBack throws an exception when fixtures is not set', function (t) {

  try {
    nmockBack();
  } catch (e) {
    t.ok(true, 'excpected exception');
    t.end();
    return;
  }

  t.fail(true, false, 'test should have ended');

});




tap.test('nmockBack wild tests', function (nw) {

  //  Manually disable net connectivity to confirm that dryrun enables it.
  nmock.disableNetConnect();

  nmockBack.fixtures = __dirname + '/fixtures';
  nmockBack.setMode('wild');

  nw.test('normal nmocks work', function (t) {
    testNMock(t);
  });

  nw.test('nmock back doesn\'t do anything', function (t) {
    nmockBackWithFixture(t, false);
  });

  setOriginalModeOnEnd(nw, nmockBack);

  nw.end();
});

tap.test('nmockBack dryrun tests', function (nw) {

  //  Manually disable net connectivity to confirm that dryrun enables it.
  nmock.disableNetConnect();

  nmockBack.fixtures = __dirname + '/fixtures';
  nmockBack.setMode('dryrun');

  nw.test('goes to internet even when no nmockBacks are running', function(t) {
    var req = http.request({
        host: "www.amazon.com"
      , path: '/'
      , port: 80
      }, function(res) {

        res.on('data', function() {
          //node v 0.10 requires this listener
        });
        t.ok([200, 301, 302].indexOf(res.statusCode) >= 0);
        t.end();

      });

    req.on('error', function(err) {

      //  This should never happen.
      t.assert(false);
      t.end();

    });

    req.end();
  });

  nw.test('normal nmocks work', function (t) {
    testNMock(t);
  });

  nw.test('uses recorded fixtures', function (t) {
    nmockBackWithFixture(t, true);
  });

  nw.test('goes it internet, doesn\'t recorded new fixtures', function (t) {

    var dataCalled = false;

    var fixture = 'someDryrunFixture.json';
    var fixtureLoc = nmockBack.fixtures + '/' + fixture;

    t.false(exists(fixtureLoc));

    nmockBack(fixture, function (done) {
      var req = http.request({
          host: "www.amazon.com"
        , path: '/'
        , port: 80
        }, function(res) {

          t.ok([200, 301, 302].indexOf(res.statusCode) >= 0);
          res.on('end', function() {
            var doneFails = false;

            t.ok(dataCalled);
            try {
              done();
              t.false(exists(fixtureLoc));
              scope.done();
            } catch(err) {
              doneFails = true;
            }
            t.ok(doneFails);
            t.end();
          });

          res.on('data', function(data) {
            dataCalled = true;
          });

        });

      req.once('error', function(err) {
        if (err.code !== 'ECONNREFUSED') {
          throw err;
        }
        t.end();
      });

      req.end();
    });
  });

  setOriginalModeOnEnd(nw, nmockBack);

  nw.end();
});

tap.test('nmockBack record tests', function (nw) {
  nmockBack.setMode('record');

  nw.test('it records when configured correctly', function (t) {
    nmockBack.fixtures = __dirname + '/fixtures';

    var options = {
      host: 'www.google.com', method: 'GET', path: '/', port: 80
    };

    var fixture = 'someFixture.json';
    var fixtureLoc = nmockBack.fixtures + '/' + fixture;

    t.false(exists(fixtureLoc));

    nmockBack(fixture, function (done) {
      http.request(options).end();
      done();

      t.true(exists(fixtureLoc));

      fs.unlinkSync(fixtureLoc);
      t.end();
    });

  });

  //Adding this test because there was an issue when not calling
  //nmock.activate() after calling nmock.restore()
  nw.test('it can record twice', function (t) {
    nmockBack.fixtures = __dirname + '/fixtures';

    var options = {
      host: 'www.google.com', method: 'GET', path: '/', port: 80
    };
    var fixture = 'someFixture2.json';
    var fixtureLoc = nmockBack.fixtures + '/' + fixture;
    t.false(exists(fixtureLoc));

    nmockBack(fixture, function (done) {
      http.request(options).end();
      done();

      t.true(exists(fixtureLoc));

      fs.unlinkSync(fixtureLoc);
      t.end();
    });

  });


  nw.test('it shouldn\'t allow outside calls', function (t) {

    var fixture = 'wrongUri.json';

    nmockBack(fixture, function (done) {

      http.get('http://www.amazon.com', function(res) {
        throw "should not request this";
      }).on('error', function(err) {
        t.equal(err.message, 'NMock: Not allow net connect for "www.amazon.com:80/"');
        done();
        t.end();
      });

    });

  });


  nw.test('it loads your recorded tests', function (t) {

    nmockBack('goodRequest.json', function (done) {
      t.true(this.scopes.length > 0);
      http.get('http://www.google.com').end();
      this.assertScopesFinished();
      done();
      t.end();
    });

  });


  nw.test('it can filter after recording', function (t) {
    nmockBack.fixtures = __dirname + '/fixtures';

    var options = {
      host: 'www.google.com', method: 'GET', path: '/', port: 80
    };

    var fixture = 'filteredFixture.json';
    var fixtureLoc = nmockBack.fixtures + '/' + fixture;

    t.false(exists(fixtureLoc));

    var afterRecord = function(scopes) {
       // You would do some filtering here, but for this test we'll just return an empty array
      return [];
    }

    nmockBack(fixture, {afterRecord: afterRecord}, function (done) {
      http.request(options).end();
      done();

      t.true(exists(fixtureLoc));

      nmockBack(fixture, function (done) {
        t.true(this.scopes.length === 0);
        done();

        fs.unlinkSync(fixtureLoc);
        t.end();
      });
    });

  });

  nw.end();

  setOriginalModeOnEnd(nw, nmockBack);
});

tap.test('nmockBack lockdown tests', function (nw) {
  nmockBack.fixtures = __dirname + '/fixtures';
  nmockBack.setMode('lockdown');

  nw.test('normal nmocks work', function (t) {
    testNMock(t);
  });


  nw.test('nmock back loads scope', function (t) {
    nmockBackWithFixture(t, true);
  });

  nw.test('no unnmocked http calls work', function (t) {
    var req = http.request({
        host: "google.com"
      , path: '/'
      }, function(res) {
        throw new Error('should not come here!');
      });


    req.on('error', function (err) {
      t.equal(err.message.trim(), 'NMock: Not allow net connect for "google.com:80/"');
      t.end();
    });


    req.end();
  });

  setOriginalModeOnEnd(nw, nmockBack);

  nw.end();
});
