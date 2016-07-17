let debug = require('debug')('nmock.common.normalize-request-options');

/**
 * Normalizes the request options so that it always has `host` property.
 *
 * @param  {Object} options - a parsed options object of the request
 */
function normalizeRequestOptions(options) {
    options.proto = options.proto || (options._https_ ? 'https' : 'http');
    options.port = options.port || ((options.proto === 'http') ? 80 : 443);
    if (options.host) {
        debug('options.host:', options.host);
        if (!options.hostname) {
            if (options.host.split(':').length == 2) {
                options.hostname = options.host.split(':')[0];
            } else {
                options.hostname = options.host;
            }
        }
    }
    debug('options.hostname in the end: %j', options.hostname);
    options.host = (options.hostname || 'localhost') + ':' + options.port;
    debug('options.host in the end: %j', options.host);

    /// lowercase host names
    ['hostname', 'host'].forEach((attr) => {
        if (options[attr]) {
            options[attr] = options[attr].toLowerCase();
        }
    });

    return options;
}

module.exports = normalizeRequestOptions;