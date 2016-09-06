let parse = require('url').parse;
let _ = require('lodash');
let http = require('http');

let {isRequestOverridden, overrideClientRequest, getOriginalClientRequest} = require('./client-request');
let {overrideRequests} = require('./../common/overriden-requests');
let {getInterceptorsFor, removeInterceptor} = require('./interceptors');
let {isNMockEnabled, isNMockDisabled} = require('./../common/nmock-status');
let globalEmitter = require('./../global_emitter');
let RequestOverrider = require('./../request_overrider');
let netConnection = require('./net-connection');
let NetConnectNotAllowedError = require('./net-connect-not-allowed-error');
let ErroringClientRequest = require('./client-request/erroring-client-request');

function activate() {
    if (isRequestOverridden()) {
        throw new Error('NMock already active');
    }

    overrideClientRequest();

    // ----- Overriding http.request and https.request:
    overrideRequests((proto, overriddenRequest, options, callback) => {
        //  NOTE: overriddenRequest is already bound to its module.
        let req;
        let res;

        if (typeof options === 'string') {
            options = parse(options);
        }
        options.proto = proto;

        let interceptors = getInterceptorsFor(options);

        if (isNMockEnabled() && interceptors) {
            let matches = !!_.find(interceptors, (interceptor) => {
                return interceptor.match(options);
            });

            let allowUnmocked = !!_.find(interceptors, (interceptor) => {
                return interceptor.options.allowUnmocked;
            });

            if (!matches && allowUnmocked) {
                if (proto === 'https') {
                    var ClientRequest = http.ClientRequest;
                    http.ClientRequest = getOriginalClientRequest();
                    req = overriddenRequest(options, callback);
                    http.ClientRequest = ClientRequest;
                } else {
                    req = overriddenRequest(options, callback);
                }
                globalEmitter.emit('no match', req);
                return req;
            }

            //  NOTE: Since we already overrode the http.ClientRequest we are in fact constructing
            //    our own OverriddenClientRequest.
            req = new http.ClientRequest(options);

            res = RequestOverrider.overrideRequest(req, options, interceptors, removeInterceptor);
            if (callback) {
                res.on('response', callback);
            }
            return req;
        } else {
            globalEmitter.emit('no match', options);
            if (isNMockDisabled() || netConnection.isEnabledForNetConnect(options)) {
                return overriddenRequest(options, callback);
            } else {
                var error = new NetConnectNotAllowedError(options.host, options.path);
                return new ErroringClientRequest(error);
            }
        }
    });
}

module.exports = activate;