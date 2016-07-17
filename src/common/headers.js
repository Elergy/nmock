let _ = require('lodash');

function headersFieldNamesToLowerCase(headers) {
    if (!_.isObject(headers)) {
        return headers;
    }

    //  For each key in the headers, delete its value and reinsert it with lower-case key.
    //  Keys represent headers field names.
    let lowerCaseHeaders = {};
    _.forOwn(headers, (fieldVal, fieldName) => {
        let lowerCaseFieldName = fieldName.toLowerCase();
        if (!_.isUndefined(lowerCaseHeaders[lowerCaseFieldName])) {
            let msg = `Failed to convert header keys to lower case due to field name conflict: ${lowerCaseFieldName}`;
            throw new Error(msg);
        }
        lowerCaseHeaders[lowerCaseFieldName] = fieldVal;
    });

    return lowerCaseHeaders;
}

function headersFieldsArrayToLowerCase(headers) {
    return _.uniq(_.map(headers, (fieldName) => fieldName.toLowerCase()));
}

/**
 * Deletes the given `fieldName` property from `headers` object by performing
 * case-insensitive search through keys.
 *
 * @headers   {Object} headers - object of header field names and values
 * @fieldName {String} field name - string with the case-insensitive field name
 */
function deleteHeadersField(headers, fieldNameToDelete) {
    if (!_.isObject(headers) || !_.isString(fieldNameToDelete)) {
        return;
    }

    const lowerCaseFieldNameToDelete = fieldNameToDelete.toLowerCase();

    //  Search through the headers and delete all values whose field name matches the given field name.
    _(headers).keys().each((fieldName) => {
        let lowerCaseFieldName = fieldName.toLowerCase();
        if (lowerCaseFieldName === lowerCaseFieldNameToDelete) {
            delete headers[fieldName];
            //  We don't stop here but continue in order to remove *all* matching field names
            //  (even though if seen regorously there shouldn't be any)
        }
    });
}

module.exports.headersFieldNamesToLowerCase = headersFieldNamesToLowerCase;
module.exports.headersFieldsArrayToLowerCase = headersFieldsArrayToLowerCase;
module.exports.deleteHeadersField = deleteHeadersField;
