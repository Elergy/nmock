let _ = require('lodash');
let debug = require('debug')('nmock.intercept.interceptors');

let normalizeRequestOptions = require('./../common/normalize-request-options');
let matchStringOrRegExp = require('./../common/match-string-or-regexp');
let Interceptor = require('./../interceptor');

let allInterceptors = {};

/**
 * get all interceptors matched with options
 * @param {Object} options request options
 * @returns {*}
 */
function getInterceptorsFor(options) {
    let basePath;
    let matchingInterceptor;

    normalizeRequestOptions(options);

    debug('interceptors for %j', options.host);

    basePath = options.proto + '://' + options.host;

    debug('filtering interceptors for basepath', basePath);

    //  First try to use filteringScope if any of the interceptors has it defined.
    _.each(allInterceptors, (interceptor) => {
        _.each(interceptor.scopes, (scope) => {
            let filteringScope = scope.__nmock_scopeOptions.filteringScope;

            //  If scope filtering function is defined and returns a truthy value
            //  then we have to treat this as a match.
            if (filteringScope && filteringScope(basePath)) {
                debug('found matching scope interceptor');

                //  Keep the filtered scope (its key) to signal the rest of the module
                //  that this wasn't an exact but filtered match.
                scope.__nmock_filteredScope = scope.__nmock_scopeKey;
                matchingInterceptor = interceptor.scopes;
                //  Break out of _.each for scopes.
                return false;
            }
        });

        if (!matchingInterceptor && matchStringOrRegExp(basePath, interceptor.key)) {
            matchingInterceptor = interceptor.scopes;
            // false to short circuit the .each
            return false;
        }

        //  Returning falsy value here (which will happen if we have found our matching interceptor)
        //  will break out of _.each for all interceptors.
        return !matchingInterceptor;
    });

    return matchingInterceptor;
}

/**
 * remove an interceptor
 * @param {Interceptor} interceptor
 */
function removeInterceptor(interceptor) {
    if (interceptor.__nmock_scope.shouldPersist() || --interceptor.counter > 0) {
        return;
    }

    const basePath = interceptor.basePath;
    let interceptors = allInterceptors[basePath] && allInterceptors[basePath].scopes || [];

    interceptors.some((thisInterceptor, i) => {
        return (thisInterceptor === interceptor) ? interceptors.splice(i, 1) : false;
    });
}

function addInterceptor(key, interceptor, scope, scopeOptions, host) {
    if (!allInterceptors.hasOwnProperty(key)) {
        allInterceptors[key] = {key: key, scopes: []};
    }
    interceptor.__nmock_scope = scope;

    //  We need scope's key and scope options for scope filtering function (if defined)
    interceptor.__nmock_scopeKey = key;
    interceptor.__nmock_scopeOptions = scopeOptions;
    //  We need scope's host for setting correct request headers for filtered scopes.
    interceptor.__nmock_scopeHost = host;
    interceptor.interceptionCounter = 0;

    allInterceptors[key].scopes.push(interceptor);
}

function removeAllInterceptors() {
    allInterceptors = {};
}

function removeInterceptorByOptions(options) {
    let baseUrl;
    let key;
    let proto;
    let method;

    if (options instanceof Interceptor) {
        baseUrl = options.basePath;
        key = options._key;
    } else {
        proto = options.proto ? options.proto : 'http';

        normalizeRequestOptions(options);
        baseUrl = proto + '://' + options.host;
        method = options.method && options.method.toUpperCase() || 'GET';
        key = method + ' ' + baseUrl + (options.path || '/');
    }

    if (allInterceptors[baseUrl] && allInterceptors[baseUrl].scopes.length > 0) {
        if (key) {
            for (let i = 0; i < allInterceptors[baseUrl].scopes.length; i++) {
                if (allInterceptors[baseUrl].scopes[i]._key === key) {
                    allInterceptors[baseUrl].scopes.splice(i, 1);
                    break;
                }
            }
        } else {
            allInterceptors[baseUrl].scopes.length = 0;
        }

        return true;
    }

    return false;
}

function isAllInterceptorsDone() {
    return _.every(allInterceptors, (interceptors) => {
        return _.every(interceptors.scopes, (interceptor) => {
            return interceptor.__nmock_scope.isDone();
        });
    });
}

function getPendingMocks() {
    return _.reduce(allInterceptors, (result, interceptors) => {
        for (let interceptor in interceptors.scopes) {
            if (interceptors.scopes.hasOwnProperty(interceptor)) {
                result = result.concat(interceptors.scopes[interceptor].__nmock_scope.pendingMocks());
            }
        }

        return result;
    }, []);
}

module.exports = {
    getInterceptorsFor,
    removeInterceptor,
    addInterceptor,
    removeAllInterceptors,
    removeInterceptorByOptions,
    isAllInterceptorsDone,
    getPendingMocks
};