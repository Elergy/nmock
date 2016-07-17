let {isFunction} = require('lodash');

function isStream(obj) {
    return obj &&
        (typeof a !== 'string') &&
        (!Buffer.isBuffer(obj)) &&
        isFunction(obj.setEncoding);
}

module.exports = isStream;