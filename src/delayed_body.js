'use strict';

let Transform = require('stream').Transform;
let EventEmitter = require('events').EventEmitter;
let isStream = require('./common/is-stream');

class FakeTransformStream extends EventEmitter {
    constructor() {
        super();
    }

    pause() {
    }

    resume() {
    }

    setEncoding() {
    }

    write(chunk, encoding) {
        process.nextTick(() => this.emit('data', chunk, encoding));
    }

    end(chunk) {
        if (chunk) {
            this.write(chunk);
        }
        process.nextTick(() => this.emit('end'));
    }
}

if (!Transform) {
    Transform = FakeTransformStream;
}

class DelayedBody extends Transform {
    constructor(ms, body) {
        super();

        let data = '';
        let ended = false;

        if (isStream(body)) {
            body.on('data', (chunk) => data += Buffer.isBuffer(chunk) ? chunk.toString() : chunk);
            body.once('end', () => ended = true);

            body.resume();
        }

        setTimeout(() => {
            if (isStream(body) && !ended) {
                body.once('end', () => this.end(data));
            } else {
                this.end(data || body);
            }
        }, ms);
    }
    
    _transform(chunk, encoding, cb) {
        this.push(chunk);
        process.nextTick(cb);
    }
}

module.exports = DelayedBody;