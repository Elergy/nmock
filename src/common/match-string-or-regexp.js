function matchStringOrRegexp(target, pattern) {
    if (pattern instanceof RegExp) {
        return target.toString().match(pattern);
    } else {
        return target === pattern;
    }
}

module.exports = matchStringOrRegexp;