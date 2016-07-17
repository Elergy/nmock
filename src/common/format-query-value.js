let _ = require('lodash');
let {percentDecode} = require('./percent-encoding');

// return [newKey, newValue]
function formatQueryValue(key, value, options) {
    switch (true) {
        case _.isNumber(value): // fall-though
        case _.isBoolean(value):
            value = value.toString();
            break;
        case _.isUndefined(value): // fall-though
        case _.isNull(value):
            value = '';
            break;
        case _.isString(value):
            if (options.encodedQueryParams) {
                value = percentDecode(value);
            }
            break;
        case (value instanceof RegExp):
            break;
        case _.isArray(value):
            let tmpArray = new Array(value.length);
            for (var i = 0; i < value.length; ++i) {
                tmpArray[i] = formatQueryValue(i, value[i], options)[1];
            }
            value = tmpArray;
            break;
        case _.isObject(value):
            let tmpObj = {};
            _.forOwn(value, (subVal, subKey) => {
                var subPair = formatQueryValue(subKey, subVal, options);
                tmpObj[subPair[0]] = subPair[1];
            });
            value = tmpObj;
            break;
    }

    if (options.encodedQueryParams) {
        key = percentDecode(key);  
    } 
    return [key, value];
}

module.exports = formatQueryValue;