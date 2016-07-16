'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require('events');

var EventEmitter = _require.EventEmitter;

var http = require('http');
var propagate = require('propagate');
var DelayedBody = require('./delayed_body');
var IncomingMessage = http.IncomingMessage;
var ClientRequest = http.ClientRequest;
var common = require('./common');
var Socket = require('./socket');
var _ = require('lodash');
var debug = require('debug')('nmock.request_overrider');
var timers = require('timers');
var ReadableStream = require('stream').Readable;
var globalEmitter = require('./global_emitter');

function _getHeader(request, name) {
    if (!request._headers) {
        return;
    }

    var key = name.toLowerCase();

    return request._headers[key];
}

function setHeader(request, name, value) {
    debug('setHeader', name, value);

    var key = name.toLowerCase();

    request._headers = request._headers || {};
    request._headerNames = request._headerNames || {};
    request._removedHeader = request._removedHeader || {};

    request._headers[key] = value;
    request._headerNames[key] = name;

    if (name == 'expect' && value == '100-continue') {
        timers.setImmediate(function () {
            debug('continue');
            request.emit('continue');
        });
    }
}

//  Sets request headers of the given request. This is needed during both matching phase
//  (in case header filters were specified) and mocking phase (to correctly pass mocked
//  request headers).
function setRequestHeaders(req, options, interceptor) {
    //  We mock request headers if these were specified.
    if (interceptor.reqheaders) {
        _.forOwn(interceptor.reqheaders, function (val, key) {
            setHeader(req, key, val);
        });
    }

    //  If a filtered scope is being used we have to use scope's host
    //  in the header, otherwise 'host' header won't match.
    //  NOTE: We use lower-case header field names throught NMock.
    var HOST_HEADER = 'host';
    if (interceptor.__nmock_filteredScope && interceptor.__nmock_scopeHost) {
        if (options && options.headers) {
            options.headers[HOST_HEADER] = interceptor.__nmock_scopeHost;
        }
        setHeader(req, HOST_HEADER, interceptor.__nmock_scopeHost);
    } else {
        //  For all other cases, we always add host header equal to the
        //  requested host unless it was already defined.
        if (options.host && !_getHeader(req, HOST_HEADER)) {
            var hostHeader = options.host;

            if (options.port === 80 || options.port === 443) {
                hostHeader = hostHeader.split(':')[0];
            }

            setHeader(req, HOST_HEADER, hostHeader);
        }
    }
}

var RequestOverrider = function () {
    function RequestOverrider(req, options, interceptors, removeInterceptor, callback) {
        _classCallCheck(this, RequestOverrider);

        this._req = req;
        this._options = _.merge(_.clone(options), {
            getHeader: function getHeader(name) {
                return _getHeader(req, name);
            }
        });
        this._interceptors = interceptors;
        this._removeInterceptor = removeInterceptor;

        this._requestBodyBuffers = [];
        this._callback = callback;

        if (IncomingMessage) {
            this._response = new IncomingMessage(new EventEmitter());
        } else {
            this._response = new ReadableStream();
            this._response._read = function () {};
        }
        this._response.req = this._req;
        this._req.socket = this._response.socket = new Socket({ proto: options.proto });

        this.setHeaders();
        this.overrideRequest();
    }

    _createClass(RequestOverrider, [{
        key: 'setHeaders',
        value: function setHeaders() {
            var _this = this;

            var _options = this._options;
            var headers = _options.headers;
            var auth = _options.auth;


            if (headers) {
                // We use lower-case header field names throught NMock.
                headers = common.headersFieldNamesToLowerCase(headers);

                _.forOwn(headers, function (val, key) {
                    setHeader(_this._req, key, val);
                });
            }

            if (auth && (!headers || !headers.authorization)) {
                setHeader(this._req, 'Authorization', 'Basic ' + new Buffer(auth).toString('base64'));
            }

            this._options.headers = headers;
        }
    }, {
        key: 'overrideRequest',
        value: function overrideRequest() {
            var _this2 = this;

            var req = this._req;
            var options = this._options;


            if (!req.connection) {
                req.connection = new EventEmitter();
            }

            req.path = options.path;

            req.write = function (buffer, encoding) {
                return _this2.requestWrite(buffer, encoding);
            };
            req.end = function (buffer, encoding) {
                return _this2.requestEnd(buffer, encoding);
            };
            req.abort = function () {
                return _this2.requestAbort();
            };
            req.on = req.once = function (event, listener) {
                return _this2.addRequestEventListener(event, listener);
            };
        }
    }, {
        key: 'requestWrite',
        value: function requestWrite(buffer, encoding) {
            var _this3 = this;

            debug('write', arguments);
            if (buffer && !this.aborted) {
                if (!Buffer.isBuffer(buffer)) {
                    buffer = new Buffer(buffer, encoding);
                }
                this._requestBodyBuffers.push(buffer);
            }
            if (this._aborted) {
                this.emitError(new Error('Request aborted'));
            }

            timers.setImmediate(function () {
                return _this3._req.emit('drain');
            });

            return false;
        }
    }, {
        key: 'requestEnd',
        value: function requestEnd(buffer, encoding) {
            debug('req.end');
            if (!this._aborted && !this._ended) {
                this._req.write(buffer, encoding);

                this.end(this._callback);

                this._req.emit('finish');
                this._req.emit('end');
            }
            if (this._aborted) {
                this.emitError(new Error('Request aborted'));
            }
        }
    }, {
        key: 'requestAbort',
        value: function requestAbort() {
            debug('req.abort');
            this._aborted = true;

            if (!this._ended) {
                this.end();
            }
            var err = new Error();
            err.code = 'aborted';
            this._response.emit('close', err);

            this._req.socket.destroy();
            this._req.emit('abort');

            var connResetError = new Error('socket hang up');
            connResetError.code = 'ECONNRESET';
            this.emitError(connResetError);
        }
    }, {
        key: 'addRequestEventListener',
        value: function addRequestEventListener(event, listener) {
            var req = this._req;

            /*
             restify listens for a 'socket' event to be emitted before calling end(),
             which causes NMock to hang with restify.
             The following logic fakes the socket behavior for restify,
             Fixes: https://github.com/pgte/nock/issues/79
             */
            if (event == 'socket') {
                listener(req.socket);
                req.socket.emit('connect', req.socket);
                req.socket.emit('secureConnect', req.socket);
            }

            EventEmitter.prototype.on.call(req, event, listener);
            return req;
        }
    }, {
        key: 'end',
        value: function end() {
            debug('ending');
            this._ended = true;
            this._continued = false;

            /*
             put back the path into options
             because bad behaving agents like superagent
             like to change request.path in mid-flight.
             */
            this._options.path = this._req.path;

            var interceptor = this.getInterceptor();

            if (!interceptor) {
                globalEmitter.emit('no match', this._req, this._options, this.getRequestBody());

                var hostInterceptor = this.getHostInterceptor();
                if (this.canDoUnmockedRequest(hostInterceptor)) {
                    this.unmockedRequest();

                    return;
                }

                var err = new Error('NMock: No match for request ' + common.stringifyRequest(this._options, this.getRequestBody()));

                err.statusCode = err.status = 404;
                this.emitError(err);

                return;
            }

            this.mockRequest(interceptor);
        }

        /**
         * get an interceptor to use for mocking
         *
         * @returns {Interceptor | null}
         */

    }, {
        key: 'getInterceptor',
        value: function getInterceptor() {
            var interceptors = this._interceptors;
            var req = this._req;
            var options = this._options;


            var requestBody = this.getRequestBody();

            // For correct matching we need to have correct request headers - if these were specified.
            interceptors.forEach(function (interceptor) {
                return setRequestHeaders(req, options, interceptor);
            });

            return _.find(interceptors, function (interceptor) {
                return interceptor.match(options, requestBody);
            });
        }

        /**
         * we using HostInterceptor when we haven't found any interceptors matched with our request
         * if we found HostInterceptor, we probably can pass unmocked request without any interception
         */

    }, {
        key: 'getHostInterceptor',
        value: function getHostInterceptor() {
            var _this4 = this;

            return _.find(this._interceptors, function (interceptor) {
                return interceptor.match(_this4._options, _this4.getRequestBody(), true);
            });
        }

        /**
         * return request body buffer as result of merging chunks from requestBodyBuffers
         * @returns {*}
         */

    }, {
        key: 'getRequestBodyBuffer',
        value: function getRequestBodyBuffer() {
            return common.mergeChunks(this._requestBodyBuffers);
        }
    }, {
        key: 'getRequestBody',
        value: function getRequestBody() {
            // When request body is a binary buffer we internally use in its hexadecimal representation.

            var requestBodyBuffer = this.getRequestBodyBuffer();
            var isBinaryRequestBodyBuffer = common.isBinaryBuffer(requestBodyBuffer);

            return isBinaryRequestBodyBuffer ? requestBodyBuffer.toString('hex') : requestBodyBuffer.toString('utf8');
        }
    }, {
        key: 'isRequestBodyBufferBinary',
        value: function isRequestBodyBufferBinary() {
            var requestBodyBuffer = this.getRequestBodyBuffer();
            return common.isBinaryBuffer(requestBodyBuffer);
        }
    }, {
        key: 'canDoUnmockedRequest',
        value: function canDoUnmockedRequest(hostInterceptor) {
            return hostInterceptor && this._req instanceof ClientRequest && hostInterceptor.options.allowUnmocked;
        }

        /**
         * send a request without any interceptions
         */

    }, {
        key: 'unmockedRequest',
        value: function unmockedRequest() {
            var newReq = new ClientRequest(this._options, this._callback);
            propagate(newReq, this._req);

            //  We send the raw buffer as we received it, not as we interpreted it.
            newReq.end(this.getRequestBodyBuffer());
        }
    }, {
        key: 'mockRequest',
        value: function mockRequest(interceptor) {
            debug('interceptor identified, starting mocking');

            var req = this._req;
            var options = this._options;
            var response = this._response;

            //  We again set request headers, now for our matched interceptor.

            setRequestHeaders(req, options, interceptor);
            interceptor.req = req;
            req.headers = req._headers;

            interceptor.scope.emit('request', req, interceptor);

            if (typeof interceptor.errorMessage !== 'undefined') {
                //TODO: write hasError method
                this.handleInterceptorError(interceptor);

                return;
            }

            response.statusCode = Number(interceptor.statusCode) || 200;

            // Clone headers/rawHeaders to not override them when evaluating later
            response.headers = _.extend({}, interceptor.headers);
            response.rawHeaders = (interceptor.rawHeaders || []).slice();
            debug('response.rawHeaders:', response.rawHeaders);

            if (this.isInterceptorWaitsCallback(interceptor)) {
                this.runInterceptorWithCallback(interceptor);

                return;
            }

            this.continueWithResponseBody(null, this.getResponseBody(interceptor), interceptor);
        }
    }, {
        key: 'handleInterceptorError',
        value: function handleInterceptorError(interceptor) {
            var _this5 = this;

            interceptor.interceptionCounter++;
            this._removeInterceptor(interceptor);
            interceptor.discard();

            var error = void 0;
            if (_.isObject(interceptor.errorMessage)) {
                error = interceptor.errorMessage;
            } else {
                error = new Error(interceptor.errorMessage);
            }

            timers.setTimeout(function (err) {
                return _this5.emitError(err);
            }, interceptor.getTotalDelay(), error);
        }
    }, {
        key: 'isInterceptorWaitsCallback',
        value: function isInterceptorWaitsCallback(interceptor) {
            return typeof interceptor.body === 'function' && interceptor.body.length === 3;
        }
    }, {
        key: 'runInterceptorWithCallback',
        value: function runInterceptorWithCallback(interceptor) {
            var _this6 = this;

            if (typeof interceptor.body === 'function') {
                var requestBody = this.getRequestBody();

                if (requestBody && common.isJSONContent(this._options.headers)) {
                    requestBody = JSON.parse(requestBody);
                }

                interceptor.body(this._options.path, requestBody || '', function (error, body) {
                    return _this6.continueWithResponseBody(error, body, interceptor);
                });
            }
        }
    }, {
        key: 'getResponseBody',
        value: function getResponseBody(interceptor) {
            if (typeof interceptor.body === 'function') {
                var requestBody = this.getRequestBody();

                if (requestBody && common.isJSONContent(this._options.headers)) {
                    requestBody = JSON.parse(requestBody);
                }

                if (interceptor.body.length !== 3) {
                    return interceptor.body(this._options.path, requestBody) || '';
                }

                return requestBody;
            }

            if (!common.isContentEncoded(this._response.headers) || common.isStream(interceptor.body)) {
                var responseBody = interceptor.body;

                //  If the request was binary then we assume that the response will be binary as well.
                //  In that case we send the response as a Buffer object as that's what the client will expect.
                if (this.isRequestBodyBufferBinary() && typeof responseBody === 'string') {
                    //  Try to create the buffer from the interceptor's body response as hex.
                    try {
                        responseBody = new Buffer(responseBody, 'hex');
                    } catch (err) {
                        debug('exception during Buffer construction from hex data:', responseBody, '-', err);
                    }

                    // Creating buffers does not necessarily throw errors, check for difference in size
                    if (!responseBody || interceptor.body.length > 0 && responseBody.length === 0) {
                        //  We fallback on constructing buffer from utf8 representation of the body.
                        responseBody = new Buffer(interceptor.body, 'utf8');
                    }
                }

                return responseBody;
            }
        }
    }, {
        key: 'getResponseBuffers',
        value: function getResponseBuffers(interceptor) {
            /* 
             If the content is encoded we know that the response body *must* be an array
             of response buffers which should be mocked one by one.
             (otherwise decompressions after the first one fails as unzip expects to receive
             buffer by buffer and not one single merged buffer)
             */

            if (common.isContentEncoded(this._response.headers) && !common.isStream(interceptor.body)) {
                if (interceptor.delayInMs) {
                    //TODO: it should break execution of this.end()
                    this.emitError(new Error('Response delay is currently not supported with content-encoded responses.'));
                    return;
                }

                var buffers = interceptor.body;
                if (!_.isArray(buffers)) {
                    buffers = [buffers];
                }

                return _.map(buffers, function (buffer) {
                    return new Buffer(buffer, 'hex');
                });
            }
        }
    }, {
        key: 'continueWithResponseBody',
        value: function continueWithResponseBody(err, responseBody, interceptor) {
            var _this7 = this;

            var response = this._response;

            if (this._continued) {
                return;
            }
            this._continued = true;

            if (err) {
                response.statusCode = 500;
                responseBody = err.stack;
            }

            if (responseBody) {
                responseBody = this.transformResponseBody(responseBody, interceptor);
            }

            interceptor.interceptionCounter++;
            this._removeInterceptor(interceptor);
            interceptor.discard();

            if (this._aborted) {
                return;
            }

            /// response.client.authorized = true
            /// fixes https://github.com/pgte/nock/issues/158
            response.client = _.extend(response.client || {}, {
                authorized: true
            });

            // Account for updates to Node.js response interface
            // cf https://github.com/request/request/pull/1615
            response.socket = _.extend(response.socket || {}, {
                authorized: true
            });

            // Evaluate functional headers.
            var evaluatedHeaders = {};
            Object.keys(response.headers).forEach(function (key) {
                var value = response.headers[key];

                if (typeof value === 'function') {
                    response.headers[key] = evaluatedHeaders[key] = value(_this7._req, response, responseBody);
                }
            });

            for (var rawHeaderIndex = 0; rawHeaderIndex < response.rawHeaders.length; rawHeaderIndex += 2) {
                var key = response.rawHeaders[rawHeaderIndex];
                var value = response.rawHeaders[rawHeaderIndex + 1];
                if (typeof value === 'function') {
                    response.rawHeaders[rawHeaderIndex + 1] = evaluatedHeaders[key];
                }
            }

            process.nextTick(function () {
                return _this7.respondWrapper(interceptor, responseBody);
            });
        }
    }, {
        key: 'transformResponseBody',
        value: function transformResponseBody(responseBody, interceptor) {
            debug('transform the response body');

            var response = this._response;
            var isResponseBodyArray = Array.isArray(responseBody) && responseBody.length >= 2 && responseBody.length <= 3 && typeof responseBody[0] == 'number';

            if (isResponseBodyArray) {
                debug('response body is array: %j', responseBody);

                response.statusCode = Number(responseBody[0]);

                debug('new headers: %j', responseBody[2]);
                if (!response.headers) {
                    response.headers = {};
                }
                _.assign(response.headers, responseBody[2] || {});
                debug('response.headers after: %j', response.headers);

                responseBody = responseBody[1];

                response.rawHeaders = response.rawHeaders || [];
                Object.keys(response.headers).forEach(function (key) {
                    return response.rawHeaders.push(key, response.headers[key]);
                });
            }

            if (interceptor.delayInMs) {
                debug('delaying the response for', interceptor.delayInMs, 'milliseconds');
                // Because setTimeout is called immediately in DelayedBody(), so we
                // need count in the delayConnectionInMs.
                responseBody = new DelayedBody(interceptor.getTotalDelay(), responseBody);
            }

            if (common.isStream(responseBody)) {
                debug('response body is a stream');
                responseBody.pause();
                responseBody.on('data', function (d) {
                    response.push(d);
                });
                responseBody.on('end', function () {
                    response.push(null);
                });
                responseBody.on('error', function (err) {
                    response.emit('error', err);
                });
            } else if (responseBody && !Buffer.isBuffer(responseBody)) {
                if (typeof responseBody === 'string') {
                    responseBody = new Buffer(responseBody);
                } else {
                    responseBody = JSON.stringify(responseBody);
                    response.headers['content-type'] = 'application/json';
                }
            }

            return responseBody;
        }
    }, {
        key: 'respondWrapper',
        value: function respondWrapper(interceptor, responseBody) {
            var _this8 = this;

            if (this._aborted) {
                return;
            }

            if (interceptor.socketDelayInMs && interceptor.socketDelayInMs > 0) {
                this._req.socket.applyDelay(interceptor.socketDelayInMs);
            }

            if (interceptor.delayConnectionInMs && interceptor.delayConnectionInMs > 0) {
                setTimeout(function () {
                    return _this8.respond(interceptor, responseBody);
                }, interceptor.delayConnectionInMs);
            } else {
                this.respond(interceptor, responseBody);
            }
        }
    }, {
        key: 'respond',
        value: function respond(interceptor, responseBody) {
            if (this._aborted) {
                return;
            }

            var response = this._response;
            var req = this._req;


            debug('emitting response');

            if (typeof this._callback === 'function') {
                debug('callback with response');
                this._callback(this._response);
            }

            if (this._aborted) {
                this.emitError(new Error('Request aborted'));
            } else {
                this._req.emit('response', response);
            }

            if (common.isStream(responseBody)) {
                debug('resuming response stream');
                responseBody.resume();

                return;
            }

            var responseBuffers = this.getResponseBuffers(interceptor) || [];
            if (typeof responseBody !== 'undefined') {
                debug('adding body to buffer list');
                responseBuffers.push(responseBody);
            }

            // Stream the response chunks one at a time.
            timers.setImmediate(function emitChunk() {
                var chunk = responseBuffers.shift();

                if (chunk) {
                    debug('emitting response chunk');
                    response.push(chunk);
                    timers.setImmediate(emitChunk);
                } else {
                    debug('ending response stream');
                    response.push(null);
                    interceptor.scope.emit('replied', req, interceptor);
                }
            });
        }
    }, {
        key: 'emitError',
        value: function emitError(error) {
            var _this9 = this;

            process.nextTick(function () {
                return _this9._req.emit('error', error);
            });
        }
    }, {
        key: 'request',
        get: function get() {
            return this._req;
        }
    }], [{
        key: 'overrideRequest',
        value: function overrideRequest(req, options, interceptors, removeInterceptor, callback) {
            var overrider = new RequestOverrider(req, options, interceptors, removeInterceptor, callback);

            return overrider.request;
        }
    }]);

    return RequestOverrider;
}();

module.exports = RequestOverrider;