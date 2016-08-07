function isEnabled() {
    return !isDisabled();
}

function isDisabled() {
    return process.env.NMOCK_OFF === 'true';
}

module.exports.isNMockEnabled = isEnabled;
module.exports.isNMockDisabled = isDisabled;