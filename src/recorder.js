'use strict';

let mergeChunks = require('./common/merge-chunks');
let {overrideRequests, restoreOverriddenRequests} = require('./common/overriden-requests');
let {isContentEncoded} = require('./common/type-content');
let {deleteHeadersField} = require('./common/headers');

var inspect = require('util').inspect;
var parse = require('url').parse;
let normalizeRequestOptions = require('./common/normalize-request-options');
let isBinaryBuffer = require('./common/is-binary-buffer');

var intercept = require('./intercept');
var debug = require('debug')('nmock.recorder');
var _ = require('lodash');
var Stream = require('stream');
var URL = require('url');

var SEPARATOR = '\n<<<<<<-- cut here -->>>>>>\n';
var recordingInProgress = false;
var outputs = [];

function getScope(options) {

  normalizeRequestOptions(options);

  var scope = [];
  if (options._https_) {
    scope.push('https://');
  } else {
    scope.push('http://');
  }

  scope.push(options.host);

  //  If a non-standard port wasn't specified in options.host, include it from options.port.
  if(options.host.indexOf(':') === -1 &&
     options.port &&
     ((options._https_ && options.port.toString() !== '443') ||
       (!options._https_ && options.port.toString() !== '80'))) {
    scope.push(':');
    scope.push(options.port);
  }

  return scope.join('');

}

function getMethod(options) {

  return (options.method || 'GET');

}

var getBodyFromChunks = function(chunks, headers) {

  //  If we have headers and there is content-encoding it means that
  //  the body shouldn't be merged but instead persisted as an array
  //  of hex strings so that the responses can be mocked one by one.
  if(isContentEncoded(headers)) {
    return _.map(chunks, function(chunk) {
      if(!Buffer.isBuffer(chunk)) {
        if (typeof chunk === 'string') {
          chunk = new Buffer(chunk);
        } else {
          throw new Error('content-encoded responses must all be binary buffers');
        }
      }

      return chunk.toString('hex');
    });
  }

  var mergedBuffer = mergeChunks(chunks);

  //  The merged buffer can be one of three things:
  //    1.  A binary buffer which then has to be recorded as a hex string.
  //    2.  A string buffer which represents a JSON object.
  //    3.  A string buffer which doesn't represent a JSON object.

  if(isBinaryBuffer(mergedBuffer)) {
    return mergedBuffer.toString('hex');
  } else {
    var maybeStringifiedJson = mergedBuffer.toString('utf8');
    try {
      return JSON.parse(maybeStringifiedJson);
    } catch(err) {
      return maybeStringifiedJson;
    }
  }

};

function generateRequestAndResponseObject(req, bodyChunks, options, res, dataChunks) {

  options.path = req.path;
  return {
    scope:    getScope(options),
    method:   getMethod(options),
    path:     options.path,
    body:     getBodyFromChunks(bodyChunks),
    status:   res.statusCode,
    response: getBodyFromChunks(dataChunks, res.headers),
    headers:  res.headers,
    reqheaders:   req._headers
  };

}

function generateRequestAndResponse(req, bodyChunks, options, res, dataChunks) {

  var requestBody = getBodyFromChunks(bodyChunks);
  var responseBody = getBodyFromChunks(dataChunks, res.headers);

  // Remove any query params from options.path so they can be added in the query() function
  var path = options.path;
  var queryIndex = 0;
  var queryObj = {};
  if ((queryIndex = req.path.indexOf('?')) !== -1) {
    path = path.substring(0, queryIndex);

    // Create the query() object
    var queries = req.path.slice(queryIndex + 1).split('&');

    for (var i = 0; i < queries.length; i++) {
      var query = queries[i].split('=');
      queryObj[query[0]] = query[1];
    }
  }

  var ret = [];
  ret.push('\nnmock(\'');
  ret.push(getScope(options));
  ret.push('\', ');
  ret.push(JSON.stringify({ encodedQueryParams: true }));
  ret.push(')\n');
  ret.push('  .');
  ret.push(getMethod(options).toLowerCase());
  ret.push('(\'');
  ret.push(path);
  ret.push("'");
  if (requestBody) {
    ret.push(', ');
    ret.push(JSON.stringify(requestBody));
  }
  ret.push(")\n");
  if (req.headers) {
    for (var k in req.headers) {
      ret.push('  .matchHeader(' + JSON.stringify(k) + ', ' + JSON.stringify(req.headers[k]) + ')\n');
    }
  }

  if (queryIndex !== -1) {
    ret.push('  .query(');
    ret.push(JSON.stringify(queryObj));
    ret.push(')\n');
  }

  ret.push('  .reply(');
  ret.push(res.statusCode.toString());
  ret.push(', ');
  ret.push(JSON.stringify(responseBody));
  if (res.headers) {
    ret.push(', ');
    ret.push(inspect(res.headers));
  }
  ret.push(');\n');

  return ret.join('');
}

//  This module variable is used to identify a unique recording ID in order to skip
//  spurious requests that sometimes happen. This problem has been, so far,
//  exclusively detected in NMock's unit testing where 'checks if callback is specified'
//  interferes with other tests as its t.end() is invoked without waiting for request
//  to finish (which is the point of the test).
var currentRecordingId = 0;

function record(rec_options) {

  //  Set the new current recording ID and capture its value in this instance of record().
  currentRecordingId = currentRecordingId + 1;
  var thisRecordingId = currentRecordingId;

  debug('start recording', thisRecordingId, JSON.stringify(rec_options));

  //  Trying to start recording with recording already in progress implies an error
  //  in the recording configuration (double recording makes no sense and used to lead
  //  to duplicates in output)
  if(recordingInProgress) {
    throw new Error('NMock recording already in progress');
  }

  recordingInProgress = true;

  //  Originaly the parameters was a dont_print boolean flag.
  //  To keep the existing code compatible we take that case into account.
  var optionsIsObject = typeof rec_options === 'object';
  var dont_print = (typeof rec_options === 'boolean' && rec_options) ||
      (optionsIsObject && rec_options.dont_print);
  var output_objects = optionsIsObject && rec_options.output_objects;
  var enable_reqheaders_recording = optionsIsObject && rec_options.enable_reqheaders_recording;
  var logging = (optionsIsObject && rec_options.logging) || console.log;
  var use_separator = true;
  if (optionsIsObject && _.has(rec_options, 'use_separator')) {
    use_separator = rec_options.use_separator;
  }

  debug(thisRecordingId, 'restoring overridden requests before new overrides');
  //  To preserve backward compatibility (starting recording wasn't throwing if NMock was already active)
  //  we restore any requests that may have been overridden by other parts of NMock (e.g. intercept)
  //  NOTE: This is hacky as hell but it keeps the backward compatibility *and* allows correct
  //    behavior in the face of other modules also overriding ClientRequest.
  restoreOverriddenRequests();
  //  We restore ClientRequest as it messes with recording of modules that also override ClientRequest (e.g. xhr2)
  intercept.restoreOverriddenClientRequest();

  //  We override the requests so that we can save information on them before executing.
  overrideRequests(function(proto, overriddenRequest, options, callback) {

    var bodyChunks = [];

    if (typeof options == 'string') {
      var url = URL.parse(options);
      options = {
        hostname: url.hostname,
        method: 'GET',
        port: url.port,
        path: url.path
      };
    }

    // Node 0.11 https.request calls http.request -- don't want to record things
    // twice.
    if (options._recording) {
      return overriddenRequest(options, callback);
    }
    options._recording = true;

    var req = overriddenRequest(options, function(res) {

      debug(thisRecordingId, 'intercepting', proto, 'request to record');

      if (typeof options === 'string') {
        options = parse(options);
      }

      //  We put our 'end' listener to the front of the listener array.
      res.once('end', function() {
        debug(thisRecordingId, proto, 'intercepted request ended');

        var out;
        if(output_objects) {
          out = generateRequestAndResponseObject(req, bodyChunks, options, res, dataChunks);
          if(out.reqheaders) {
            //  We never record user-agent headers as they are worse than useless -
            //  they actually make testing more difficult without providing any benefit (see README)
            deleteHeadersField(out.reqheaders, 'user-agent');

            //  Remove request headers completely unless it was explicitly enabled by the user (see README)
            if(!enable_reqheaders_recording) {
              delete out.reqheaders;
            }
          }
        } else {
          out = generateRequestAndResponse(req, bodyChunks, options, res, dataChunks);
        }

        debug('out:', out);

        //  Check that the request was made during the current recording.
        //  If it hasn't then skip it. There is no other simple way to handle
        //  this as it depends on the timing of requests and responses. Throwing
        //  will make some recordings/unit tests faily randomly depending on how
        //  fast/slow the response arrived.
        //  If you are seeing this error then you need to make sure that all
        //  the requests made during a single recording session finish before
        //  ending the same recording session.
        if(thisRecordingId !== currentRecordingId) {
          debug('skipping recording of an out-of-order request', out);
          return;
        }

        outputs.push(out);

        if (!dont_print) {
          if (use_separator) {
            logging(SEPARATOR + out + SEPARATOR);
          } else {
            logging(out);
          }
        }
      });

      var dataChunks = [];
      var encoding;

      // We need to be aware of changes to the stream's encoding so that we
      // don't accidentally mangle the data.
      var setEncoding = res.setEncoding;
      res.setEncoding = function (newEncoding) {
        encoding = newEncoding;
        return setEncoding.apply(this, arguments);
      };

      // Replace res.push with our own implementation that stores chunks
      var origResPush = res.push;
      res.push = function(data) {
        if (data) {
          if (encoding) {
            data = new Buffer(data, encoding);
          }
          dataChunks.push(data);
        }

        return origResPush.call(res, data);
      }

      if (callback) {
        callback(res, options, callback);
      } else {
        res.resume();
      }

      debug('finished setting up intercepting');

      if (proto === 'https') {
        options._https_ = true;
      }

    });

    var oldWrite = req.write;
    req.write = function(data, encoding) {
      if ('undefined' !== typeof(data)) {
        if (data) {
          debug(thisRecordingId, 'new', proto, 'body chunk');
          if (! Buffer.isBuffer(data)) {
            data = new Buffer(data, encoding);
          }
          bodyChunks.push(data);
        }
        oldWrite.call(req, data);
      }
    };

    return req;
  });
}

//  Restores *all* the overridden http/https modules' properties.
function restore() {
  debug(currentRecordingId, 'restoring all the overridden http/https properties');

  restoreOverriddenRequests();
  intercept.restoreOverriddenClientRequest();
  recordingInProgress = false;
}

function clear() {
  outputs = [];
}

exports.record = record;
exports.outputs = function() {
  return outputs;
};
exports.restore = restore;
exports.clear = clear;