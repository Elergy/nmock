let _ = require('lodash');

/**
 * If the chunks are Buffer objects then it returns a single Buffer object with the data from all the chunks.
 * If the chunks are strings then it returns a single string value with data from all the chunks.
 *
 * @param  {Array} chunks - an array of Buffer objects or strings
 *
 * @returns {Buffer|String}
 */
function mergeChunks(chunks) {
    if (_.isEmpty(chunks)) {
        return new Buffer(0);
    }

    //  We assume that all chunks are Buffer objects if the first is buffer object.
    var areBuffers = Buffer.isBuffer(_.first(chunks));

    if (!areBuffers) {
        //  When the chunks are not buffers we assume that they are strings.
        return chunks.join('');
    }

    //  Merge all the buffers into a single Buffer object.
    return Buffer.concat(chunks);
}

module.exports = mergeChunks;