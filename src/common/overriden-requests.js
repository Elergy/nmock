let debug = require('debug')('nmock.common.overriden-requests');
let http = require('http');
let https = require('https');
let _ = require('lodash');

//  Array where all information about all the overridden requests are held.
let requestOverride = [];

/**
 * Overrides the current `request` function of `http` and `https` modules with
 * our own version which intercepts issues HTTP/HTTPS requests and forwards them
 * to the given `newRequest` function.
 *
 * @param  {Function} newRequest - a function handling requests; it accepts four arguments:
 *   - proto - a string with the overridden module's protocol name (either `http` or `https`)
 *   - overriddenRequest - the overridden module's request function already bound to module's object
 *   - options - the options of the issued request
 *   - callback - the callback of the issued request
 */
function overrideRequests(newRequest) {
    debug('overriding requests');

    ['http', 'https'].forEach((proto) => {
        debug('- overriding request for', proto);
        
        const moduleName = proto;
        let module = {
            http,
            https
        }[moduleName];
        
        const overriddenRequest = module.request;

        if (requestOverride[moduleName]) {
            throw new Error('Module\'s request already overridden for ' + moduleName + ' protocol.');
        }

        //  Store the properties of the overridden request so that it can be restored later on.
        requestOverride[moduleName] = {
            module: module,
            request: overriddenRequest
        };

        module.request = (options, callback) => newRequest(proto, overriddenRequest.bind(module), options, callback);

        debug('- overridden request for', proto);
    });
}

/**
 * Restores `request` function of `http` and `https` modules to values they
 * held before they were overridden by us.
 */
function restoreOverriddenRequests() {
    debug('restoring requests');

    //  Restore any overridden requests.
    _(requestOverride).keys().each((proto) => {
        debug('- restoring request for', proto);

        let override = requestOverride[proto];
        if (override) {
            override.module.request = override.request;
            debug('- restored request for', proto);
        }
    });
    requestOverride = [];
}

module.exports.overrideRequests = overrideRequests;
module.exports.restoreOverriddenRequests = restoreOverriddenRequests;