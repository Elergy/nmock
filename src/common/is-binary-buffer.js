function compareBuffers(lhs, rhs) {
    if (lhs.length !== rhs.length) {
        return false;
    }

    for (let i = 0; i < lhs.length; ++i) {
        if (lhs[i] !== rhs[i]) {
            return false;
        }
    }

    return true;
}

/**
 * Returns true if the data contained in buffer is binary which in this case means
 * that it cannot be reconstructed from its utf8 representation.
 *
 * @param  {object} buffer - a Buffer object
 *
 * @returns {boolean}
 */
function isBinaryBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) {
        return false;
    }

    //  Test if the buffer can be reconstructed verbatim from its utf8 encoding.
    let utfEncodedBuffer = buffer.toString('utf8');
    let reconstructedBuffer = new Buffer(utfEncodedBuffer, 'utf8');

    //  If the buffers are *not* equal then this is a "binary buffer"
    //  meaning that it cannot be faitfully represented in utf8.
    return !compareBuffers(buffer, reconstructedBuffer);
}

module.exports = isBinaryBuffer;