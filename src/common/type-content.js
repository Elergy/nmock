let {
    isString,
    get
} = require('lodash');

function isContentEncoded(headers) {
    let contentEncoding = get(headers, 'content-encoding');
    return isString(contentEncoding) && contentEncoding !== '';
}

function isJSONContent(headers) {
    let contentType = get(headers, 'content-type');
    if (Array.isArray(contentType)) {
        contentType = contentType[0];
    }
    contentType = (contentType || '').toLocaleLowerCase();

    return contentType === 'application/json';
}

module.exports.isContentEncoded = isContentEncoded;
module.exports.isJSONContent = isJSONContent;