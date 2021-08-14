/* global require, module */
"use strict";

/**
 * Trim custom character
 *
 * @param {string} str
 * @param {string} charToRemove
 *
 * @return {string}
 */
module.exports = function trimChar( str, charToRemove ) {
    while ( str.charAt( 0 ) === charToRemove ) {
        str = str.substring( 1 );
    }
    while ( str.charAt( str.length - 1 ) === charToRemove ) {
        str = str.substring( 0, str.length - 1 );
    }
    return str;
}
