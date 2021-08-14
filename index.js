/* global require, module */
"use strict";

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
    await app.run();
}
