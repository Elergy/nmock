let http = require('http');
let _ = require('lodash');

let debug = require('debug')('nmock.intercept.client-request');

let OverriddenClientRequest = require('./overridden-client-request');

let originalClientRequest;

function override() {
    debug('Overriding ClientRequest');

    if (isOverridden()) {
        throw new Error('NMock already overrode http.ClientRequest');
    }

    //  Override the http module's request but keep the original so that we can use it and later restore it.
    //  NOTE: We only override http.ClientRequest as https module also uses it.
    originalClientRequest = http.ClientRequest;
    http.ClientRequest = OverriddenClientRequest;

    debug('ClientRequest overridden');

}

function restore() {
    debug('restoring overriden ClientRequest');

    //  Restore the ClientRequest we have overridden.
    if (!originalClientRequest) {
        debug('- ClientRequest was not overridden');
    } else {
        http.ClientRequest = originalClientRequest;
        originalClientRequest = undefined;

        debug('- ClientRequest restored');
    }
}

function get() {
    return originalClientRequest;
}

function isOverridden() {
    return !_.isUndefined(originalClientRequest);
}

module.exports = {
    override,
    restore,
    isOverridden,
    get
};