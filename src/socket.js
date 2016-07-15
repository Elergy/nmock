'use strict';

let {EventEmitter} = require('events');
let debug = require('debug')('nmock.socket');

class Socket extends EventEmitter {
    constructor(options) {
        super();

        EventEmitter.apply(this);

        options = options || {};

        if (options.proto === 'https') {
            this.authorized = true;
        }

        this.writable = true;
        this.readable = true;
        this.destroyed = false;

        this.setNoDelay = noop;
        this.setKeepAlive = noop;
        this.resume = noop;

        // totalDelay that has already been applied to the current
        // request/connection, timeout error will be generated if
        // it is timed-out.
        this.totalDelayMs = 0;
        // Maximum allowed delay. Null means unlimited.
        this.timeoutMs = null;
    }

    setTimeout(timeoutMs, fn) {
        this.timeoutMs = timeoutMs;
        this.timeoutFunction = fn;
    }

    applyDelay(delayMs) {
        this.totalDelayMs += delayMs;

        if (this.timeoutMs && this.totalDelayMs > this.timeoutMs) {
            debug('socket timeout');
            if (this.timeoutFunction) {
                this.timeoutFunction();
            } else {
                this.emit('timeout');
            }
        }
    }

    getPeerCertificate() {
        return new Buffer((Math.random() * 10000 + Date.now()).toString()).toString('base64');
    }

    destroy() {
        this.destroyed = true;
        this.readable = this.writable = false;
    }
}

function noop() {}

module.exports = Socket;
