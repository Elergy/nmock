let {OutgoingMessage, ClientRequest} = require('http');
let {EventEmitter} = require('events');
let timers = require('timers');

let debug = require('debug')('nmock.intercept.client-request');

let {isNMockEnabled, isNMockDisabled} = require('./../../common/nmock-status');
let {getInterceptorsFor, removeInterceptor} = require('./../interceptors');
let RequestOverrider = require('./../../request_overrider');
let {isEnabledForNetConnect} = require('./../net-connection');
let NetConnectNotAllowedError = require('./../net-connect-not-allowed-error');
let inherits = require('util').inherits;

/**
 * overrided clientRequest that NMock uses internally
 */
class OverriddenClientRequest {

    constructor(options, callback) {
        if (OutgoingMessage) {
            OutgoingMessage.call(this);
        }
        
        let interceptors = getInterceptorsFor(options);

        if (isNMockEnabled() && interceptors) {
            debug('using', interceptors.length, 'interceptors');

            //  Use filtered interceptors to intercept requests.
            let overrider = RequestOverrider.overrideRequest(this, options, interceptors, removeInterceptor, callback);

            for (let propName in overrider) {
                if (overrider.hasOwnProperty(propName)) {
                    this[propName] = overrider[propName];
                }
            }
        } else {
            debug('falling back to original ClientRequest');

            //  Fallback to original ClientRequest if NMock is off or the net connection is enabled.
            if (isNMockDisabled() || isEnabledForNetConnect(options)) {
                let originalClientRequest = require('./original-client-request');
                originalClientRequest.get().apply(this, arguments);
            } else {
                timers.setImmediate(() => {
                    let error = new NetConnectNotAllowedError(options.host, options.path);
                    this.emit('error', error);
                });
            }
        }
    }
}

if (ClientRequest) {
    inherits(OverriddenClientRequest, ClientRequest);
} else {
    inherits(OverriddenClientRequest, EventEmitter);
}

module.exports = OverriddenClientRequest;