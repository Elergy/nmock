function stringifyRequest(options, body) {
    let {
        method,
        proto,
        hostname,
        path,
        port
    } = options;
    
    method = method || 'GET';

    if (body && typeof(body) !== 'string') {
        body = body.toString();
    }

    if (!port) {
        port = proto == 'https' ? '443' : '80';
    }

    if (proto == 'https' && port == '443' || proto == 'http' && port == '80') {
        port = '';
    }
    
    if (port) {
        port = `:${port}`;
    }
    
    return `${method} ${proto}://${hostname}${port}${path} ${body}`;
}

module.exports = stringifyRequest;