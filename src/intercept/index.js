let activate = require('./activate');
let clientRequest = require('./client-request');
let interceptors = require('./interceptors');

let netConnection = require('./net-connection');

activate();

module.exports = interceptors.addInterceptor;
module.exports.removeAll = interceptors.removeAllInterceptors;
module.exports.removeInterceptor = interceptors.removeInterceptorByOptions;
module.exports.activate = activate;
module.exports.isActive = clientRequest.isRequestOverridden;
module.exports.isDone = interceptors.isAllInterceptorsDone;
module.exports.pendingMocks = interceptors.getPendingMocks;
module.exports.enableNetConnect = netConnection.enableNetConnect;
module.exports.disableNetConnect = netConnection.disableNetConnect;
module.exports.overrideClientRequest = clientRequest.override;
module.exports.restoreOverriddenClientRequest = clientRequest.restoreOverriddenClientRequest;
