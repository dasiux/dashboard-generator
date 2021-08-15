/* global require, module, process, JSON */
'use strict';

/**
 * Requires
 */
const path = require( 'path' );
const fs = require( 'fs' );
const fileType = require( 'file-type' );
const fetch = require( 'node-fetch');
const Twig = require( 'twig' );
const sass = require( 'node-sass' );
const merge = require( 'deepmerge' );
const minify = require('html-minifier').minify;
const cfx = require( '@squirrel-forge/node-cfx' ).cfx
const strSlug = require( './strSlug' );
const strCreate = require( './strCreate' );
const trimChar = require( './trimChar' );
const parseInput = require( './parseInput' );

/**
 * Dashboard Generator class
 * @type {DashboardGenerator}
 */
module.exports = class DashboardGenerator {

    /**
     * Constructor
     * @param {string} dirname
     */
    constructor( dirname ) {

        // Local module directory
        this._local = path.resolve( dirname, '../' );

        // Current working directory
        this._cwd = process.cwd();

        // Source json directory
        this._loaded = null;

        // Input arguments and options
        this._input = parseInput();

        // Defaults
        this._defaults = null;

        // Source data
        this._source = null;

        // Compiled data
        this._data = null;

        // Dev mode
        this._dev = false;

        // Supply twig with an icon filter
        this._extendTwig();
    }

    /**
     * Extend twig engine
     * @private
     */
    _extendTwig() {
        Twig.extendFilter('icon', ( value ) => {
            if ( typeof this._data.icons !== 'object' ) {
                return '';
            }
            const icons = Object.keys( this._data.icons );
            if ( icons.length ) {
                const slug = strSlug( value );
                if ( icons.includes( slug ) ) {
                    return 'data-icon="' + slug + '"';
                }
            }
            return '';
        } );
    }

    /**
     * Read local file as buffer
     * @private
     * @param {string} file
     * @param {string} enc
     * @return {Promise<Buffer|null>}
     */
    _read_local( file, enc = 'utf8' ) {
        return new Promise( ( resolve ) => {
            fs.readFile( file, enc, ( err, content ) => {
                if ( err ) {
                    cfx.error( err );
                    resolve( null );
                } else {
                    const buffer = Buffer.from( content );
                    resolve( buffer );
                }
            } );
        } );
    }

    /**
     * Read remote file as buffer
     * @private
     * @param {string} file
     * @return {Promise<Buffer|null>}
     */
    _read_remote( file ) {
        return new Promise( ( resolve ) => {
            fetch( file ).then( async ( res ) => {
                const file_buffer = await res.buffer();
                resolve( file_buffer );
            } ).catch( ( err ) => {
                cfx.error( err );
                resolve( null );
            } );
        } );
    }

    /**
     * Resolve file
     * @private
     * @param {string} file
     * @param {null|string} enc
     * @param {Object} from
     * @return {Promise<{path, ext, content, type}|null>}
     */
    async _resolve_file( file, enc = null, from = null ) {
        const options = { remote : true, cwd : true, local : true, json : true };
        if ( from ) {
            Object.assign( options, from );
        }
        const o = {};
        if ( options.remote && file.substr( 0, 4 ) === 'http' ) {
            o.path = file;
            o.ext = path.extname( file );
            o.content = await this._read_remote( file );
            if ( !o.content ) {
                return null;
            }
        } else {
            let local, local_exists = false;
            if ( options.json && this._loaded ) {
                local = this._local_path( file, this._loaded );
                local_exists = await this._local_exists( local );
            }
            if ( !local_exists && options.cwd ) {
                local = this._local_path( file, this._cwd );
                local_exists = await this._local_exists( local );
            }
            if ( !local_exists && options.local ) {
                local = this._local_path( file, this._local );
                local_exists = await this._local_exists( local );
            }
            if ( !local_exists ) {
                return null;
            }
            o.path = local;
            o.content = await this._read_local( local, enc );
            o.content = Buffer.from( o.content );
            o.ext = path.extname( local );
        }
        o.type = await fileType.fromBuffer( o.content );
        return o;
    }

    /**
     * Resolve text file
     * @private
     * @param {string} file
     * @param {Object} from
     * @return {Promise<{path, ext, content, type, text}|null>}
     */
    async _resolve_text( file, from = null ) {
        const o = await this._resolve_file( file, 'utf8', from );
        if ( o && o.content ) {
            o.text = o.content.toString( 'utf8' );
        }
        return o;
    }

    /**
     * Resolve json file
     * @private
     * @param {string} file
     * @param {Object} from
     * @return {Promise<{path, ext, content, type, json}|null>}
     */
    async _resolve_json( file, from = null ) {
        const o = await this._resolve_text( file, from );
        if ( o && o.content instanceof Buffer ) {
            try {
                o.json = JSON.parse( o.content.toString( 'utf8' ) );
            } catch ( e ) {
                cfx.error( e );
                return null;
            }
        }
        return o;
    }

    /**
     * Resolve local path
     * @private
     * @param {string} file
     * @param {string} base
     * @return {string}
     */
    _local_path( file, base ) {
        let load_path = file;
        if ( !( load_path.charAt( 0 ) === '/' || load_path.charAt( 0 ) === '.' ) ) {
            load_path = './' + load_path;
        }
        if ( base && load_path && load_path.charAt( 0 ) === '.' ) {
            load_path = path.resolve( base, file );
        } else {
            load_path = path.resolve( file );
        }
        return load_path;
    }

    /**
     * Check if local file exists
     * @private
     * @param {string} file
     * @param {string} base
     * @param {string} type
     * @return {Promise<boolean>}
     */
    _local_exists( file, base, type = 'R_OK' ) {
        return new Promise( ( resolve ) => {
            let load_path = file;
            if ( base ) {
                load_path = this._local_path( file, base );
            }
            fs.access( load_path, fs.constants[ type ], ( err ) => {
                if ( err ) {
                    resolve( false );
                } else {
                    resolve( true );
                }
            });
        } );
    }

    /**
     * Write local file
     * @private
     * @param {string} content
     * @param {string} file
     * @return {Promise<boolean>}
     */
    _local_write( content, file ) {
        return new Promise( ( resolve ) => {
            const load_path = this._local_path( file, this._cwd );
            fs.writeFile( load_path, content, ( err ) => {
                if ( err ) {
                    cfx.error( err );
                    resolve( false );
                } else {
                    resolve( true );
                }
            });
        } );
    }

    /**
     * Render template
     * @private
     * @param {Object} data
     * @return {Promise<string>}
     */
    _render_template( data ) {
        return new Promise( ( resolve ) => {
            const template = path.resolve( this._local, 'template/index.twig' );
            Twig.renderFile( template, data, ( err, html ) => {
                if ( err ) {
                    cfx.error( err );
                    resolve( null );
                } else {
                    resolve( html );
                }
            } );
        } );
    }

    /**
     * Node sass render
     * @private
     * @param {Object} options
     * @return {Promise<Object>}
     */
    _render_node_sass( options ) {
        return new Promise( ( resolve ) => {
            sass.render( options, ( err, result ) => {
                if ( err ) {
                    cfx.error( err );
                    resolve( null );
                } else {
                    resolve( result );
                }
            } );
        } );
    }

    /**
     * Get scss theme vars from json structure
     * @private
     * @param {Object} data
     * @param {Array} path
     * @return {[]}
     */
    _theme_get_vars( data, path = [] ) {
        const vars = [];
        const keys = Object.keys( data );
        for ( let i = 0; i < keys.length; i++ ) {
            const k = keys[ i ];
            const curr_path = [ ...path ];
            curr_path.push( k );
            if ( data[ k ] && data[ k ] !== null ) {
                if ( typeof data[ k ] === 'object' ) {
                    const nested = this._theme_get_vars( data[ k ], curr_path );
                    vars.push( ...nested );
                } else {
                    vars.push( '$' + curr_path.join( '-' ) + ': ' + data[ k ] + ';' );
                }
            }
        }
        return vars;
    }

    /**
     * Get list of unique icon slugs
     * @private
     * @param {Object} data
     * @param {Set} slugs
     * @return {Set<string>}
     */
    _get_icon_slugs( data, slugs ) {
        slugs = slugs || new Set();
        const keys = Object.keys( data );
        for ( let i = 0; i < keys.length; i++ ) {
            const k = keys[ i ];
            slugs.add( strSlug( k ) );
            if ( data[ k ] !== null ) {
                if ( typeof data[ k ] === 'object' ) {
                    this._get_icon_slugs( data[ k ], slugs );
                }
            }
        }
        return slugs;
    }

    /**
     * Build theme icon image css
     * @private
     * @return {Promise<string>}
     */
    async _theme_css_icon_images() {
        if ( !this._data.icons || typeof this._data.icons !== 'object' || !Object.keys( this._data.icons ).length ) {
            return '';
        }
        const possible = [ ...this._get_icon_slugs( this._data.tree ) ];
        const icons = [];
        for ( let i = 0; i < possible.length; i++ ) {
            const name = possible[ i ];
            const file = this._data.icons[ name ];
            if ( file && file.length ) {
                const data = await this._get_base64_image_url( file );
                icons.push( '[data-icon="' + name + '"]::before {\n  background-image: url(' + data + ');\n}' );
            }
        }
        return icons.join( '\n' );
    }

    /**
     * Build theme background image css
     * @private
     * @return {Promise<string>}
     */
    async _theme_css_background_images() {
        let src = this._data.background;
        if ( this._data.theme.background.style !== 'image' || !src || !src.length ) {
            return '';
        }
        if ( !( src instanceof Array ) ) {
            src = [ src ];
        }
        const bgs = [];
        for ( let i = 0; i < src.length; i++ ) {
            const data = await this._get_base64_image_url( src[ i ], { local : false } );
            bgs.push( '.background--image[data-index="' + i + '"] {\n background-image: url(' + data + ');\n}' );
        }
        this._data.bgcount = bgs.length;
        return bgs.join( '\n' );
    }

    /**
     * Render scss theme
     * @private
     * @param {string} file
     * @param {string} extend
     * @return {Promise<string|null>}
     */
    async _render_theme( file, extend ) {

        // Load theme base file
        const load_theme = await this._resolve_text( file, { remote : false, cwd : false, json : false } );
        if ( !load_theme || !load_theme.text || !load_theme.text.length ) {
            return null;
        }
        const scss_theme = load_theme.text;

        // Load custom extend
        let scss_extend = '';
        if ( extend && extend.length ) {
            const load_extend = await this._resolve_text( extend, { local : false } );
            if ( !load_extend || !load_extend.text || !load_extend.text.length ) {
                cfx.warn( 'Skipping after: failed to load theme scss extension from: "' + extend + '"' );
            } else {
                scss_extend = load_extend.text;
            }
        }

        // Build scss theme vars from data
        const theme = this._theme_get_vars( this._data.theme ).join( '\n' );

        // Build css for icons with embedded images
        const icons = await this._theme_css_icon_images();

        // Build css for background image mode
        const bgs = await this._theme_css_background_images();

        // Setup node-sass options
        const options = {
            file : load_theme.path,
            data : theme + scss_theme + icons + bgs + scss_extend,
        };
        if ( this._dev ) {
            cfx.warn( '-- begin: theme <<' );
            console.log( this._data );
            cfx.warn( '>> end: theme --' );
        } else {
            options.outputStyle = 'compressed';
        }

        // Render scss to css
        const styles = await this._render_node_sass( options );
        if ( !styles ) {
            return '';
        }
        return styles.css.toString();
    }

    /**
     * Get image as base64 url
     * @private
     * @param {string} image
     * @param {Object} from
     * @return {Promise<string>}
     */
    async _get_base64_image_url( image, from ) {
        const allowed_types = [ '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico' ];
        const allowed_mimes = [ 'image/png', 'image/jpeg', 'image/jpeg', 'image/svg+xml', 'image/apng', 'image/x-icon' ];
        const loaded_file = await this._resolve_file( image, null, from );
        if ( !loaded_file || !( loaded_file.content instanceof Buffer ) ) {
            cfx.warn( 'Failed to load image from: "' + image + '"' );
        } else {
            if ( !loaded_file.type || loaded_file.type.ext === 'xml' ) {
                const ext = path.extname( image );
                const known = allowed_types.indexOf( ext );
                if ( known > -1 ) {
                    loaded_file.type = { ext : ext.substr( 1 ) , mime : allowed_mimes[ known ] };
                }
            }
            if ( loaded_file.type && loaded_file.type.mime.split( '/' )[ 0 ] === 'image' ) {
                return 'data:' + loaded_file.type.mime + ';base64,' + loaded_file.content.toString( 'base64' );
            } else {
                cfx.error( 'Failed to detect mimetype for: "' + loaded_file.path + '"' );
            }
        }
        return image;
    }

    /**
     * Get flag/option value
     * @private
     * @param {string} flag
     * @param {*} def
     * @return {null|boolean|string}
     */
    _get_flag_value( flag, def = null ) {
        let value = def;
        for ( let i = 0; i < this._input.flags.length; i++ ) {
            if ( this._input.flags[ i ] instanceof Array && this._input.flags[ i ][ 0 ] === flag ) {
                value = trimChar( trimChar( this._input.flags[ i ][ 1 ], '"' ), "'" );
            } else if ( this._input.flags[ i ] === flag ) {
                value = true;
            }
        }
        return value;
    }

    /**
     * Set theme options from arguments
     * @private
     * @return {{}}
     */
    _set_theme_options() {
        const theme = {};
        for ( let i = 0; i < this._input.flags.length; i++ ) {
            if ( this._input.flags[ i ] instanceof Array && this._input.flags[ i ][ 0 ].substr( 0, 4 ) === '--t-' ) {
                const value = trimChar( trimChar( this._input.flags[ i ][ 1 ], '"' ), "'" );
                const name = this._input.flags[ i ][ 0 ].substr( 4 ).replace( /-/, '.' );
                theme[ name ] = value;
                strCreate( name, value, this._data.theme, true, true, this._dev ? console : null );
            }
        }
        return theme;
    }

    /**
     * Run generator
     * @return {Promise<number>}
     */
    async run() {

        // Development mode
        this._dev = this._input.flags.includes( '-d' ) || this._input.flags.includes( '--dev' );

        // Load defaults
        const defaults = await this._resolve_json( 'template/defaults.json', { remote : false, cwd : false, json : false } );
        if ( !defaults || !defaults.json ) {
            cfx.error( 'Failed to load defaults, please reinstall or fix what you\'ve broken.' );
            return 1;
        }
        if ( this._dev ) {
            cfx.warn( '-- begin: defaults <<' );
            console.log( defaults.json );
            cfx.warn( '>> end: defaults --' );
        }
        this._defaults = defaults.json;

        // Get input source
        const input = this._input.args[ 0 ] || ''
        if ( !input || !input.length ) {
            cfx.error( 'Invalid input path.' );
            return 2;
        }

        // Get output destination
        let target = this._get_flag_value( '-o' ) || this._get_flag_value( '--output' );
        target = target && target.length ? this._local_path( target, this._cwd ) : '';

        // Allow custom filename
        if ( target && target.length ) {
            if ( !( path.basename( target ) !== path.basename( target, path.extname( target ) ) ) ) {
                target = path.resolve( target, 'index.html' );
            }
        }

        // Target exists
        const replace = this._input.flags.includes( '-r' ) || this._input.flags.includes( '--replace' );
        const exists = await this._local_exists( target, this._cwd, 'W_OK' );
        if ( !replace && exists ) {
            cfx.error( 'Target file already exists, use the -r or --replace option to replace the target file.' );
            return 3;
        }

        // Require source
        const source = await this._resolve_json( input, { local : false, json : false } );
        if ( !source || !source.json ) {
            cfx.error( 'No valid source JSON could be loaded from: "' + input + '"' );
            return 4;
        }
        if ( typeof source.json.tree !== 'object' || !Object.keys( source.json.tree ).length ) {
            cfx.error( 'Source JSON must have a root level property named "tree" with at least one group and link.' );
            return 5;
        }
        if ( this._dev ) {
            cfx.warn( '-- begin: source <<' );
            console.log( source.json );
            cfx.warn( '>> end: source --' );
        }
        this._loaded = path.dirname( source.path );
        this._source = source.json;

        // Extend default with source as base data
        this._data = merge( this._defaults, this._source );

        // Set theme option values
        const theme_options = this._set_theme_options();
        if ( this._dev ) {
            cfx.warn( '-- begin: theme options <<' );
            console.log( theme_options );
            cfx.warn( '>> end: theme options --' );
        }

        // Add internal data
        this._data.year = new Date().getFullYear();
        if ( this._dev ) {
            cfx.warn( '-- begin: compiled <<' );
            console.log( this._data );
            cfx.warn( '>> end: compiled --' );
        }

        // Add images
        if ( this._data.logo && this._data.logo.length ) {
            this._data.logo = await this._get_base64_image_url( this._data.logo, { local : false } );
        }

        // Render styles
        const extend_sass = this._get_flag_value( '-s' ) || this._get_flag_value( '--sass' );
        const styles_doc = await this._render_theme( 'sass/dashboard.scss', extend_sass );
        if ( !styles_doc ) {
            cfx.error( 'Failed to render theme styles.' );
            return 6;
        }
        this._data.styles = styles_doc;

        // Render js
        const js_doc = await this._resolve_text( 'template/dashboard.js', { remote : false, cwd : false, json : false } );
        if ( !js_doc || !js_doc.text || !js_doc.text.length ) {
            cfx.error( 'Failed to load theme javascript.' );
            return 7;
        }
        this._data.javascript = js_doc.text;

        // Render template
        let rendered_doc;
        try {
            rendered_doc = await this._render_template( this._data );
        } catch ( e ) {
            cfx.log( e );
            return 8;
        }

        // Minify
        let minified_doc;
        try {
            minified_doc = minify( rendered_doc, this._dev ? {} : this._data.options.minify );
        } catch ( e ) {
            cfx.log( e );
            return 9;
        }

        // Write document
        const doc = await this._local_write( minified_doc, target );
        if ( !doc ) {
            cfx.error( 'Failed to write dashboard file to: "' + target + '"' );
            return 9;
        }

        // End success
        cfx.success( 'Dashboard ' + ( exists && replace ? 'updated' : 'created' ) + ' at: ' + target );
        return 0;
    }
}
