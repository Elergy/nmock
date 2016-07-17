function percentDecode(str) {
    try {
        return decodeURIComponent(str.replace(/\+/g, ' '));
    } catch (e) {
        return str;
    }
}

function percentEncode(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

module.exports.percentDecode = percentDecode;
module.exports.percentEncode = percentEncode;