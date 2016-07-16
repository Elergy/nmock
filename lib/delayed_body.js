'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Transform = require('stream').Transform;
var EventEmitter = require('events').EventEmitter;
var common = require('./common');

var FakeTransformStream = function (_EventEmitter) {
    _inherits(FakeTransformStream, _EventEmitter);

    function FakeTransformStream() {
        _classCallCheck(this, FakeTransformStream);

        return _possibleConstructorReturn(this, Object.getPrototypeOf(FakeTransformStream).call(this));
    }

    _createClass(FakeTransformStream, [{
        key: 'pause',
        value: function pause() {}
    }, {
        key: 'resume',
        value: function resume() {}
    }, {
        key: 'setEncoding',
        value: function setEncoding() {}
    }, {
        key: 'write',
        value: function write(chunk, encoding) {
            var _this2 = this;

            process.nextTick(function () {
                return _this2.emit('data', chunk, encoding);
            });
        }
    }, {
        key: 'end',
        value: function end(chunk) {
            var _this3 = this;

            if (chunk) {
                this.write(chunk);
            }
            process.nextTick(function () {
                return _this3.emit('end');
            });
        }
    }]);

    return FakeTransformStream;
}(EventEmitter);

if (!Transform) {
    Transform = FakeTransformStream;
}

var DelayedBody = function (_Transform) {
    _inherits(DelayedBody, _Transform);

    function DelayedBody(ms, body) {
        _classCallCheck(this, DelayedBody);

        var _this4 = _possibleConstructorReturn(this, Object.getPrototypeOf(DelayedBody).call(this));

        var data = '';
        var ended = false;

        if (common.isStream(body)) {
            body.on('data', function (chunk) {
                return data += Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
            });
            body.once('end', function () {
                return ended = true;
            });

            body.resume();
        }

        setTimeout(function () {
            if (common.isStream(body) && !ended) {
                body.once('end', function () {
                    return _this4.end(data);
                });
            } else {
                _this4.end(data || body);
            }
        }, ms);
        return _this4;
    }

    _createClass(DelayedBody, [{
        key: '_transform',
        value: function _transform(chunk, encoding, cb) {
            this.push(chunk);
            process.nextTick(cb);
        }
    }]);

    return DelayedBody;
}(Transform);

module.exports = DelayedBody;