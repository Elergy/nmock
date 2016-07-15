'use strict';

var _ = require('lodash');
var nmock = require('./scope');
var recorder = require('./recorder');

var format = require('util').format;
var path = require('path');
var expect = require('chai').expect;
var debug = require('debug')('nmock.back');

var _mode = null;

var fs;

try {
  fs = require('fs');
} catch(err) {
  // do nothing, probably in browser
}

var mkdirp;
try {
  mkdirp = require('mkdirp');
} catch(err) {
  // do nothing, probably in browser
}


/**
 * NMock the current function with the fixture given
 *
 * @param {string}   fixtureName  - the name of the fixture, e.x. 'foo.json'
 * @param {object}   options      - [optional], extra options for NMock with, e.x. { assert: true }
 * @param {function} mockedFn     - the callback function to be executed with the given fixture being loaded,
 *                                  the function will be called with { scopes: loaded_nmocks || [] } set as this
 *
 *
 * List of options:
 *
 * @param {function} before       - a preprocessing function, gets called before nmock.define
 * @param {function} after        - a postprocessing function, gets called after nmock.define
 * @param {function} afterRecord  - a postprocessing function, gets called after recording. Is passed the array
 *                                  of scopes recorded and should return the array scopes to save to the fixture
 * @param {function} recorder     - custom options to pass to the recorder
 *
 */
function Back (fixtureName, options, mockedFn) {
  if(!Back.fixtures) {
    throw new Error(  'Back requires nmock.back.fixtures to be set\n' +
                      'Ex:\n' +
                      '\trequire(nmock).back.fixtures = \'/path/to/fixures/\'');
  }

  if( arguments.length === 2 ) {
    mockedFn = options;
    options = {};
  }

  _mode.setup();

  var fixture = path.join(Back.fixtures, fixtureName)
    , context = _mode.start(fixture, options);


  var nmockDone = function () {
    _mode.finish(fixture, options, context);
  };

  debug('context:', context);

  mockedFn.call(context, nmockDone);
}




/*******************************************************************************
*                                    Modes                                     *
*******************************************************************************/


var wild = {


  setup: function () {
    nmock.cleanAll();
    recorder.restore();
    nmock.activate();
    nmock.enableNetConnect();
  },


  start: function () {
    return load(); //don't load anything but get correct context
  },


  finish: function () {
    //nothing to do
  }


};




var dryrun = {


  setup: function () {
    recorder.restore();
    nmock.cleanAll();
    nmock.activate();
    //  We have to explicitly enable net connectivity as by default it's off.
    nmock.enableNetConnect();
  },


  start: function (fixture, options) {
    var contexts = load(fixture, options);

    nmock.enableNetConnect();
    return contexts;
  },


  finish: function () {
    //nothing to do
  }


};




var record = {


  setup: function () {
    recorder.restore();
    recorder.clear();
    nmock.cleanAll();
    nmock.activate();
    nmock.disableNetConnect();
  },


  start: function (fixture, options) {
    if (! fs) {
      throw new Error('no fs');
    }
    var context = load(fixture, options);

    if( !context.isLoaded ) {
      recorder.record(_.assign({
        dont_print: true,
        output_objects: true
      }, options && options.recorder));

      context.isRecording = true;
    }

    return context;
  },


  finish: function (fixture, options, context) {
    if( context.isRecording ) {
      var outputs = recorder.outputs();

      if( typeof options.afterRecord === 'function' ) {
        outputs = options.afterRecord(outputs);
      }

      outputs = JSON.stringify(outputs, null, 4);
      debug('recorder outputs:', outputs);

      mkdirp.sync(path.dirname(fixture));
      fs.writeFileSync(fixture, outputs);
    }
  }


};




var lockdown = {


  setup: function () {
    recorder.restore();
    recorder.clear();
    nmock.cleanAll();
    nmock.activate();
    nmock.disableNetConnect();
  },


  start: function (fixture, options) {
    return load(fixture, options);
  },


  finish: function () {
    //nothing to do
  }


};




function load (fixture, options) {
  var context = {
    scopes : [],
    assertScopesFinished: function () {
      assertScopes(this.scopes, fixture);
    }
  };

  if( fixture && fixtureExists(fixture) ) {
    var scopes = nmock.loadDefs(fixture);
    applyHook(scopes, options.before);

    scopes = nmock.define(scopes);
    applyHook(scopes, options.after);

    context.scopes = scopes;
    context.isLoaded = true;
  }


  return context;
}




function applyHook(scopes, fn) {
  if( !fn ) {
    return;
  }

  if( typeof fn !== 'function' ) {
    throw new Error ('processing hooks must be a function');
  }

  scopes.forEach(fn);
}




function fixtureExists(fixture) {
  if (! fs) {
    throw new Error('no fs');
  }

  return fs.existsSync(fixture);
}




function assertScopes (scopes, fixture) {
  scopes.forEach(function (scope) {
    expect( scope.isDone() )
    .to.be.equal(
      true,
      format('%j was not used, consider removing %s to rerecord fixture', scope.pendingMocks(), fixture)
    );
  });
}




var Modes = {

  wild: wild, //all requests go out to the internet, dont replay anything, doesnt record anything

  dryrun: dryrun, //use recorded mocks, allow http calls, doesnt record anything, useful for writing new tests (default)

  record: record, //use recorded mocks, record new mocks

  lockdown: lockdown //use recorded mocks, disables all http calls even when not mocked, doesnt record

};





Back.setMode = function(mode) {
  if( !Modes.hasOwnProperty(mode) ) {
    throw new Error ('some usage error');
  }

  Back.currentMode = mode;
  debug('New NMock back mode:', Back.currentMode);

  _mode = Modes[mode];
  _mode.setup();
};




Back.fixtures = null;
Back.currentMode = null;
Back.setMode(process.env.NMOCK_BACK_MODE || 'dryrun');

module.exports = Back;
