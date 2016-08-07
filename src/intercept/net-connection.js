let _ = require('lodash');

let debug = require('debug')('nmock.intercept.net-connection');
let normalizeRequestOptions = require('./../common/normalize-request-options');

let allowNetConnect;

/**
 * Enabled real request.
 * @public
 * @param {String|RegExp} matcher=RegExp.new('.*') Expression to match
 * @example
 * // Enables all real requests
 * nmock.enableNetConnect();
 * @example
 * // Enables real requests for url that matches google
 * nmock.enableNetConnect('google');
 * @example
 * // Enables real requests for url that matches google and amazon
 * nmock.enableNetConnect(/(google|amazon)/);
 */
function enableNetConnect(matcher) {
    if (_.isString(matcher)) {
        allowNetConnect = new RegExp(matcher);
    } else if (_.isObject(matcher) && _.isFunction(matcher.test)) {
        allowNetConnect = matcher;
    } else {
        allowNetConnect = /.*/;
    }
}

function isEnabledForNetConnect(options) {
    normalizeRequestOptions(options);

    const enabled = allowNetConnect && allowNetConnect.test(options.host);
    debug('Net connect', enabled ? '' : 'not', 'enabled for', options.host);
    return enabled;
}

/**
 * Disable all real requests.
 * @public
 * @example
 * nmock.disableNetConnect();
 */
function disableNetConnect() {
    allowNetConnect = undefined;
}

module.exports.enableNetConnect = enableNetConnect;
module.exports.isEnabledForNetConnect = isEnabledForNetConnect;
module.exports.disableNetConnect = disableNetConnect;
