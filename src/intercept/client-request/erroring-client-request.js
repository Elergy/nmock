let {ClientRequest, OutgoingMessage} = require('http');
let inherits = require('util').inherits;

class ErroringClientRequest {
    constructor(error) {
        if (OutgoingMessage) {
            OutgoingMessage.call(this);
        }

        process.nextTick(() => this.emit('error', error));
    }
}

if (ClientRequest) {
    inherits(ErroringClientRequest, ClientRequest);
}

module.exports = ErroringClientRequest;