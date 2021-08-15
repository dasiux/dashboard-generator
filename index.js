/* global require, module, process */
'use strict';

/**
 * Requires
 */
const DashboardGenerator = require( './src/DashboardGenerator' );

/**
 * Initialize cli
 *
 * @param {string} dir - __dirname of binary
 *
 * @return {Object} - Cli instance
 */
module.exports = async function cli( dir ) {

    /**
     * Initialize application
     */
    const app = new DashboardGenerator( dir );

    // Run application
    const code = await app.run();
    process.exit( code );
}
