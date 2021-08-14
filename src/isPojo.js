/* global require, module */
"use strict";

/**
 * Is a plain object
 *
 * @param {Object} obj - Object to test
 *
 * @return {boolean} - True if subject is a plain object
 */
module.exports = function isPojo( obj ) {
    if ( obj === null || typeof obj !== 'object' ) {
        return false;
    }
    return Object.getPrototypeOf( obj ) === Object.prototype;
}
