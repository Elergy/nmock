'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('events');

var EventEmitter = _require.EventEmitter;

var debug = require('debug')('nmock.socket');

var Socket = function (_EventEmitter) {
    _inherits(Socket, _EventEmitter);

    function Socket(options) {
        _classCallCheck(this, Socket);

        var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Socket).call(this));

        EventEmitter.apply(_this);

        options = options || {};

        if (options.proto === 'https') {
            _this.authorized = true;
        }

        _this.writable = true;
        _this.readable = true;
        _this.destroyed = false;

        _this.setNoDelay = noop;
        _this.setKeepAlive = noop;
        _this.resume = noop;

        // totalDelay that has already been applied to the current
        // request/connection, timeout error will be generated if
        // it is timed-out.
        _this.totalDelayMs = 0;
        // Maximum allowed delay. Null means unlimited.
        _this.timeoutMs = null;
        return _this;
    }

    _createClass(Socket, [{
        key: 'setTimeout',
        value: function setTimeout(timeoutMs, fn) {
            this.timeoutMs = timeoutMs;
            this.timeoutFunction = fn;
        }
    }, {
        key: 'applyDelay',
        value: function applyDelay(delayMs) {
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
    }, {
        key: 'getPeerCertificate',
        value: function getPeerCertificate() {
            return new Buffer((Math.random() * 10000 + Date.now()).toString()).toString('base64');
        }
    }, {
        key: 'destroy',
        value: function destroy() {
            this.destroyed = true;
            this.readable = this.writable = false;
        }
    }]);

    return Socket;
}(EventEmitter);

function noop() {}

module.exports = Socket;