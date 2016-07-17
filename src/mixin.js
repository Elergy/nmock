'use strict';
let _ = require('lodash');

function mixin(a, b) {
    if (!a) {
        a = {};
    }
    if (!b) {
        b = {};
    }
    a = _.cloneDeep(a);
    
    for (let prop in b) {
        if (b.hasOwnProperty(prop)) {
            a[prop] = b[prop];
        }
    }
    return a;
}

module.exports = mixin;
