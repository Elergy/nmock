let originalClientRequest = require('./original-client-request');

module.exports = {
    overrideClientRequest: originalClientRequest.override,
    restoreOverriddenClientRequest: originalClientRequest.restore,
    isRequestOverridden: originalClientRequest.isOverridden,
    getOriginalClientRequest: originalClientRequest.get
};