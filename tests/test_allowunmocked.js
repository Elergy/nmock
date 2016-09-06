'use strict';

var test          = require('tap').test;
var mikealRequest = require('request');
var nmock = require('../');

test('allowUnmock', function(t) {
  nmock.enableNetConnect();
  var scope = nmock('https://www.google.com/', {allowUnmocked: true})
  .get('/pathneverhit')
  .reply(200, {foo: 'bar'});

  var options = {
    method: 'GET',
    uri: 'https://www.google.com'
  };

  mikealRequest(options, function(err, resp, body) {
    t.notOk(err, 'should be no error');
    t.true(typeof body !== 'undefined', 'body should not be undefined');
    t.true(body.length !== 0, 'body should not be empty');
    t.end();
    return console.log(resp.statusCode, 'body length: ', body.length);
  });
});

test('allow unmock  with regex', function(t) {
    var mockOptions = {
        allowUnmocked: true
    };
    
    var scope = nmock('https://www.google.com', mockOptions)
        .persist()
        .get(/test/)
        .reply(200, {foo: 'bar'});
    
    var mockedRequestOptions = {
        method: 'GET',
        uri: 'https://www.google.com/test'
    };
    
    var passedRequestOptions = {
        method: 'GET',
        uri: 'https://www.google.com'
    };

    var mockedRequest = new Promise(function (resolve) {
        mikealRequest(mockedRequestOptions, function(err, resp, body) {
            t.notOk(err, 'should be no error');
            t.equal(JSON.parse(body).foo, 'bar', 'body should be overrided');
            
            resolve();
        });
    });
    
    var passedRequest = new Promise(function (resolve) {
        mikealRequest(passedRequestOptions, function(err, resp, body) {
            t.notOk(err, 'should be no error');
            
            var isJSON = true;
            try {
                JSON.parse(body);
            } catch(ex) {
                isJSON = false;
            }
            t.notOk(isJSON, 'should return original response');

            resolve();
        });
    });

    Promise.all([mockedRequest, passedRequest]).then(function() {
        nmock.cleanAll();
        t.end();
    });
});

test('allow unmock  with regex', function(t) {
    var mockOptions = {
        allowUnmocked: true
    };

    var scope = nmock('https://www.google.com', mockOptions)
        .persist()
        .get(/test/)
        .query(function(actualQuery) {
            return actualQuery && actualQuery.param === 'value';
        })
        .reply(200, {foo: 'bar'});

    var mockedRequestOptions = {
        method: 'GET',
        uri: 'https://www.google.com/test?param=value'
    };

    var passedRequestOptions = {
        method: 'GET',
        uri: 'https://www.google.com/test?test=4'
    };

    var mockedRequest = new Promise(function (resolve) {
        mikealRequest(mockedRequestOptions, function(err, resp, body) {
            t.notOk(err, 'should be no error');
            t.equal(JSON.parse(body).foo, 'bar', 'body should be overrided');

            resolve();
        });
    });

    var passedRequest = new Promise(function (resolve) {
        mikealRequest(passedRequestOptions, function(err, resp, body) {
            t.notOk(err, 'should be no error');

            var isJSON = true;
            try {
                JSON.parse(body);
            } catch(ex) {
                isJSON = false;
            }
            t.notOk(isJSON, 'should return original response');

            resolve();
        });
    });

    Promise.all([mockedRequest, passedRequest]).then(function() {
        nmock.cleanAll();
        t.end();
    });
});