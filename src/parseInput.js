/* global require, module, process */
"use strict";

/**
 * Parse arguments
 *
 * @param {null|Array} args - Arguments
 *
 * @private
 *
 * @return {void}
 */
module.exports = function parseInput( args ) {

    // Default remove the command call itself from the args
    args = args || process.argv.slice( 2 );

    // Data
    const input = {
        args : [],
        flags : [],
    };

    // Set args and flags
    for ( let i = 0; i < args.length; i++ ) {
        if ( args[ i ][ 0 ] === '-' ) {
            let flag = args[ i ];
            if ( flag.indexOf( '=' ) > -1 ) {
                flag = flag.split( '=' );
            }
            input.flags.push( flag );
        } else {
            input.args.push( args[ i ] );
        }
    }

    // Input data
    return input;
}
