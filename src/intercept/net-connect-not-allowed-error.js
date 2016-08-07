class NetConnectNotAllowedError extends Error {
    constructor(host, path) {
        super();

        this.name = 'NetConnectNotAllowedError';
        this.message = 'NMock: Not allow net connect for "' + host + path + '"';

        super.constructor.captureStackTrace(this, this.constructor);
    }
}

module.exports = NetConnectNotAllowedError;