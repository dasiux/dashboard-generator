/* global require, module */
"use strict";

/**
 * Requires
 */
const isPojo = require( './isPojo.js' );

/**
 * Get typed path part
 *
 * @private
 *
 * @param {string} part - Path element
 * @return {string|Number} - Typed element
 */
function getPart( part ) {

    // Check for integer
    if ( part == parseInt( part ) ) {
        return parseInt( part );
    }
    return part;
}

/**
 * Create deep object structure from string
 *
 * @param {string} strpath - Dotted value path
 * @param {*} value - Value to be set
 * @param {Object|Array} target - Target object or array
 * @param {boolean} replace - Replace values
 * @param {boolean} any - Extend any type of object
 * @param {Object} debug - Debugger instance
 *
 * @return {Object|Array} - Target
 */
module.exports = function strCreate( strpath, value, target, replace = false, any = false, debug = null ) {
    const parts = strpath.split( '.' );
    const path = [];
    let i, part, to, next, last, source = target;

    // Check path
    for ( i = 0; i < parts.length; i++ ) {
        part = getPart( parts[ i ] );
        path.push( part );
        to = Object.prototype.hasOwnProperty.call( source, part ) ? typeof source[ part ] : 'undefined';
        if ( !any && to === 'object' && !isPojo( source[ part ] ) && !( source[ part ] instanceof Array ) ) {
            to = 'value';
        }
        last = i + 1 === parts.length;
        next = last ? null : getPart( parts[ i + 1 ] );

        // Path undefined and need to be created
        if ( to === 'undefined' && !last ) {
            source[ part ] = typeof next === 'number' ? [] : {};
            to = 'object';
        }

        // Last part
        if ( last ) {

            // Create or replace value
            if ( replace || to === 'undefined' || source[ part ] === null ) {
                source[ part ] = value;

                // Already defined and no replace option
            } else {
                if ( debug ) {
                    debug.warn( 'strCreate : already defined "' + strpath + '" [' + to + ']' );
                }
                return target;
            }

            // Iterate created or existing path
        } else if ( to === 'object' ) {
            source = source[ part ];

            // Replace value with new structure
        } else if ( replace && !last ) {
            source[ part ] = typeof next === 'number' ? [] : {};
            source = source[ part ];

            // Path cannot be extended a non object value was part of the path
        } else {
            if ( debug ) {
                debug.warn( 'strCreate : partially defined "' + strpath + '" as "' + path.join( '.' ) + '" [' + to + ']' );
            }
            return target;
        }
    }
    return target;
}
