'use strict';

var _ = require('lodash');
var nmock = require('./scope');
var recorder = require('./recorder');

var _require = require('util');

var format = _require.format;

var path = require('path');

var _require2 = require('chai');

var expect = _require2.expect;

var debug = require('debug')('nmock.back');

var _mode = null;

var fs = void 0;

try {
    fs = require('fs');
} catch (err) {
    // do nothing, probably in browser
}

var mkdirp = void 0;
try {
    mkdirp = require('mkdirp');
} catch (err) {}
// do nothing, probably in browser


// /**
//  * NMock the current function with the fixture given
//  */
// class Back {
//     /**
//      *
//      * @param {string} fixtureName the name of the fixture, e.x. 'foo.json'
//      * @param {object} [options] extra options for NMock with, e.g. { assert: true }
//      * @param {function} mockedFn the callback function to be executed with the given fixture being loaded,
//      * the function will be called with { scopes: loaded_nmocks || [] } set as this
//      */
//     constructor(fixtureName, options, mockedFn) {
//
//     }
// }

/**
 *
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
function Back(fixtureName, options, mockedFn) {
    if (!Back.fixtures) {
        throw new Error('Back requires nmock.back.fixtures to be set\n' + 'Ex:\n' + '\trequire(nmock).back.fixtures = \'/path/to/fixures/\'');
    }

    if (arguments.length === 2) {
        mockedFn = options;
        options = {};
    }

    _mode.setup();

    var fixture = path.join(Back.fixtures, fixtureName),
        context = _mode.start(fixture, options);

    var nmockDone = function nmockDone() {
        _mode.finish(fixture, options, context);
    };

    debug('context:', context);

    mockedFn.call(context, nmockDone);
}

/*******************************************************************************
 *                                    Modes                                     *
 *******************************************************************************/

var wild = {

    setup: function setup() {
        nmock.cleanAll();
        recorder.restore();
        nmock.activate();
        nmock.enableNetConnect();
    },

    start: function start() {
        return load(); //don't load anything but get correct context
    },

    finish: function finish() {
        //nothing to do
    }

};

var dryrun = {

    setup: function setup() {
        recorder.restore();
        nmock.cleanAll();
        nmock.activate();
        //  We have to explicitly enable net connectivity as by default it's off.
        nmock.enableNetConnect();
    },

    start: function start(fixture, options) {
        var contexts = load(fixture, options);

        nmock.enableNetConnect();
        return contexts;
    },

    finish: function finish() {
        //nothing to do
    }

};

var record = {

    setup: function setup() {
        recorder.restore();
        recorder.clear();
        nmock.cleanAll();
        nmock.activate();
        nmock.disableNetConnect();
    },

    start: function start(fixture, options) {
        if (!fs) {
            throw new Error('no fs');
        }
        var context = load(fixture, options);

        if (!context.isLoaded) {
            recorder.record(_.assign({
                dont_print: true,
                output_objects: true
            }, options && options.recorder));

            context.isRecording = true;
        }

        return context;
    },

    finish: function finish(fixture, options, context) {
        if (context.isRecording) {
            var outputs = recorder.outputs();

            if (typeof options.afterRecord === 'function') {
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

    setup: function setup() {
        recorder.restore();
        recorder.clear();
        nmock.cleanAll();
        nmock.activate();
        nmock.disableNetConnect();
    },

    start: function start(fixture, options) {
        return load(fixture, options);
    },

    finish: function finish() {
        //nothing to do
    }

};

function load(fixture, options) {
    var context = {
        scopes: [],
        assertScopesFinished: function assertScopesFinished() {
            assertScopes(this.scopes, fixture);
        }
    };

    if (fixture && fixtureExists(fixture)) {
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
    if (!fn) {
        return;
    }

    if (typeof fn !== 'function') {
        throw new Error('processing hooks must be a function');
    }

    scopes.forEach(fn);
}

function fixtureExists(fixture) {
    if (!fs) {
        throw new Error('no fs');
    }

    return fs.existsSync(fixture);
}

function assertScopes(scopes, fixture) {
    scopes.forEach(function (scope) {
        expect(scope.isDone()).to.be.equal(true, format('%j was not used, consider removing %s to rerecord fixture', scope.pendingMocks(), fixture));
    });
}

var Modes = {

    //all requests go out to the internet, dont replay anything, doesnt record anything
    wild: wild,

    //use recorded mocks, allow http calls, doesnt record anything, useful for writing new tests (default)
    dryrun: dryrun,

    record: record, //use recorded mocks, record new mocks

    lockdown: lockdown //use recorded mocks, disables all http calls even when not mocked, doesnt record

};

Back.setMode = function (mode) {
    if (!Modes.hasOwnProperty(mode)) {
        throw new Error('some usage error');
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