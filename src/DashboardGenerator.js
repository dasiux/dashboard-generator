/* global require, module, process, JSON */
"use strict";

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
const strSlug = require( './strSlug' );
const strCreate = require( './strCreate' );
const trimChar = require( './trimChar' );
const parseInput = require( './parseInput' );

/**
 * Dashboard Generator class
 *
 * @type {DashboardGenerator}
 */
module.exports = class DashboardGenerator {

    constructor( dirname ) {
        this._bin = dirname;
        this._cwd = process.cwd();
        this._input = parseInput();
        this._defaults = null;
        this._data = null;
        this._dev = false;
        this._extendTwig();
    }

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

    async _local_json( file, base ) {
        const content = await this._local_file( file, base );
        let json;
        try {
            json = JSON.parse( content );
        } catch ( e ) {
            console.error( e );
            json = null;
        }
        return json;
    }

    _local_file( file, base ) {
        return new Promise( ( resolve ) => {
            const load_path = this._local_path( file, base );
            fs.readFile( load_path, 'utf8', ( err, content ) => {
                if ( err ) {
                    console.error( err );
                    resolve( null );
                } else {
                    resolve( content );
                }
            } );
        } );
    }

    _local_path( file, base ) {
        let load_path = file;
        if ( !( load_path.charAt( 0 ) === '/' || load_path.charAt( 0 ) === '.' ) ) {
            load_path = './' + load_path;
        }
        if ( load_path && load_path.charAt( 0 ) === '.' ) {
            load_path = path.resolve( base, file );
        } else {
            load_path = path.resolve( file );
        }
        return load_path;
    }

    _local_exists( file, base ) {
        return new Promise( ( resolve ) => {
            const load_path = this._local_path( file, base );
            fs.access( load_path, fs.constants.W_OK, ( err ) => {
                if ( err ) {
                    resolve( false );
                } else {
                    resolve( true );
                }
            });
        } );
    }

    _local_write( content, file, base ) {
        return new Promise( ( resolve ) => {
            const load_path = this._local_path( file, base );
            fs.writeFile( load_path, content, ( err ) => {
                if ( err ) {
                    console.error( 'fs.writeFile', err );
                    resolve( false );
                } else {
                    resolve( true );
                }
            });
        } );
    }

    async _load_source( input ) {
        let source = null;
        if ( input && input.length ) {
            try {
                source = await this._local_json( input, this._cwd );
            } catch ( e ) {
                console.error( e );
                source = null;
            }
        }
        return source;
    }

    _render_template( data ) {
        return new Promise( ( resolve, reject ) => {
            const template = path.resolve( this._bin, '../template/index.twig' );
            Twig.renderFile( template, data, ( err, html ) => {
                if ( err ) {
                    reject( err );
                } else {
                    resolve( html );
                }
            } );
        } );
    }

    _render_styles( options ) {
        return new Promise( ( resolve ) => {
            sass.render( options, ( err, result ) => {
                if ( err ) {
                    console.error( err );
                    resolve( null );
                } else {
                    resolve( result );
                }
            } );
        } );
    }

    _theme_get_vars( data, path = [] ) {
        const vars = [];
        const keys = Object.keys( data );
        for ( let i = 0; i < keys.length; i++ ) {
            const k = keys[ i ];
            const curr_path = [ ...path ];
            curr_path.push( k );
            if ( data[ k ] !== null ) {
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

    _generate_possible_icons() {
        return [ ...this._get_icon_slugs( this._data.tree )];
    }

    _build_theme_vars() {
        return this._theme_get_vars( this._data.theme ).join( '\n' );
    }

    async _build_icon_css() {
        if ( !this._data.icons || !Object.keys( this._data.icons ).length ) {
            return '';
        }
        const possible = this._generate_possible_icons();
        const icons = [];
        for ( let i = 0; i < possible.length; i++ ) {
            const name = possible[ i ];
            if ( this._data.icons[ name ] ) {
                const data = await this._get_encoded_image( this._data.icons[ name ], this._cwd );
                icons.push( '[data-icon="' + name + '"]::before {\n  background-image: url(' + data + ');\n}' );
            }
        }
        return icons.join( '\n' );
    }

    async _build_background() {
        let src = this._data.background;
        if ( this._data.theme.background.style !== 'image' || !src || !src.length ) {
            return '';
        }
        if ( !( src instanceof Array ) ) {
            src = [ src ];
        }
        const bgs = [];
        for ( let i = 0; i < src.length; i++ ) {
            const data = await this._get_encoded_image( src[ i ], this._cwd );
            bgs.push( '.background--image[data-index="' + i + '"] {\n background-image: url(' + data + ');\n}' );
        }
        this._data.bgcount = bgs.length;
        return bgs.join( '\n' );
    }

    async _render_theme( file, base, extend, xbase ) {
        const load_path = this._local_path( file, base );
        const loaded_file = await this._local_file( load_path, base );
        if ( !loaded_file && !loaded_file.length ) {
            return null;
        }
        let extended = '';
        if ( extend && extend.length ) {
            const load_sass = this._local_path( extend, xbase );
            const loaded_sass = await this._local_file( load_sass, xbase );
            if ( !loaded_sass && !loaded_sass.length ) {
                return null;
            }
            extended = loaded_sass;
        }
        const theme = this._build_theme_vars();
        const icons = await this._build_icon_css();
        const bgs = await this._build_background();
        const options = {
            file : load_path,
            data : theme + '\n' + loaded_file + icons + bgs + extended,
        };
        if ( this._dev ) {
            console.log( '> theme sass' );
            console.log( options.data );
            console.log( '---' );
        } else {
            options.outputStyle = 'compressed';
        }
        const styles = await this._render_styles( options );
        if ( !styles ) {
            return '';
        }
        return styles.css.toString();
    }

    async _render_js( file, base ) {
        const load_path = this._local_path( file, base );
        const loaded_file = await this._local_file( load_path, base );
        if ( !loaded_file && !loaded_file.length ) {
            return null;
        }
        return loaded_file;
    }

    _get_encoded_image( image, base ) {
        const allowed_types = [ '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico' ];
        const allowed_mimes = [ 'image/png', 'image/jpeg', 'image/jpeg', 'image/svg+xml', 'image/apng', 'image/x-icon' ];
        const resolver = async ( image_buffer, resolve ) => {
            let type = await fileType.fromBuffer( image_buffer );
            if ( !type || type.ext === 'xml' ) {
                const ext = path.extname( image );
                const known = allowed_types.indexOf( ext );
                if ( known > -1 ) {
                    type = { ext : ext.substr( 1 ) , mime : allowed_mimes[ known ] };
                }
            }
            if ( type && type.mime.split( '/' )[ 0 ] === 'image' ) {
                resolve( 'data:' + type.mime + ';base64,' + image_buffer.toString( 'base64' ) );
            } else {
                resolve( image );
            }
        };
        return new Promise( ( resolve ) => {
            if ( image.substr( 0, 4 ) === 'http' ) {
                fetch( image ).then( async ( res ) => {
                    const image_buffer = await res.buffer();
                    resolver( image_buffer, resolve );
                } ).catch( ( err ) => {
                    console.error( err );
                    resolve( image );
                } );
            } else {
                const load_image = this._local_path( image, base );
                const image_file = fs.readFileSync( load_image );
                const image_buffer = Buffer.from( image_file );
                resolver( image_buffer, resolve );
            }
        } );
    }

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

    _get_theme_flags( set ) {
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

    async run() {

        // Load defaults
        this._defaults = await this._local_json( '../template/defaults.json', this._bin );
        if ( !this._defaults ) {
            console.error( 'Defaults are broken, please reinstall or fix what you\'ve broken.' );
            return 2;
        }

        // Get arguments and options
        const input = this._input.args[ 0 ] || ''

        // Get options
        this._dev = this._input.flags.includes( '-d' ) || this._input.flags.includes( '--dev' );
        const replace = this._input.flags.includes( '-r' ) || this._input.flags.includes( '--replace' );
        const extend_sass = this._get_flag_value( '-s' ) || this._get_flag_value( '--sass' );

        // Get target directory, uses cwd if not defined
        let target_dir = this._get_flag_value( '-o' ) || this._get_flag_value( '--output' );
        if ( !target_dir ) {
            target_dir = '';
        } else if ( target_dir.length && target_dir.substr( -1 ) !== '/' ) {
            target_dir = target_dir + '/';
        }

        // Target exists
        const exists = await this._local_exists( target_dir + 'index.html', this._cwd );
        if ( !replace && exists ) {
            console.error( 'Target file already exists.' );
            return 1;
        }

        // Require source
        const source = await this._load_source( input );
        if ( !source ) {
            console.error( 'No valid JSON map could be loaded.' );
            return 2;
        }
        this._data = merge( this._defaults, source );

        // Set theme option values
        const theme_options = this._get_theme_flags( true );
        if ( this._dev ) {
            console.log( theme_options );
        }

        // Add internal data
        this._data.year = new Date().getFullYear();

        // Add images
        if ( this._data.logo && this._data.logo.length ) {
            this._data.logo = await this._get_encoded_image( this._data.logo, this._cwd );
        }

        // Render styles
        const styles_doc = await this._render_theme( '../sass/dashboard.scss', this._bin, extend_sass, this._cwd );
        if ( !styles_doc ) {
            console.error( 'Failed to render styles.' );
            return 3;
        }
        this._data.styles = styles_doc;

        // Render js
        const js_doc = await this._render_js( '../template/dashboard.js', this._bin );
        if ( !js_doc ) {
            console.error( 'Failed to render js.' );
            return 4;
        }
        this._data.javascript = js_doc;

        // Render template
        let rendered_doc;
        try {
            rendered_doc = await this._render_template( this._data );
        } catch ( e ) {
            console.log( e );
            return 5;
        }

        // Minify
        const minified_doc = minify( rendered_doc, this._dev ? {} : this._data.options.minify );

        // Allow custom filename
        let file_name = 'index.html';
        if ( target_dir && target_dir.length ) {
            if ( path.basename( target_dir ) !== path.basename( target_dir, path.extname( target_dir ) ) ) {
                file_name = '';
            }
        }

        // Write document
        const doc = await this._local_write( minified_doc, target_dir + file_name, this._cwd );
        if ( !doc ) {
            console.error( 'Failed to write dashboard file.' );
            return 6;
        }

        // End success
        console.info( 'Dashboard ' + ( exists && replace ? 'updated' : 'created' ) + '.' );
        return 0;
    }
}
