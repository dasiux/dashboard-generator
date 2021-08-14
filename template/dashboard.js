( function() {
    'strict';

    var h_align = [ 'left', 'center', 'right' ];
    var v_align = [ 'top', 'center', 'bottom' ];

    function randomInt( min, max ) {
        min = Math.ceil( min );
        max = Math.floor( max );
        return Math.floor( Math.random() * ( max - min + 1 ) ) + min;
    }

    function leadingZeros( num, length ) {
        num = num + '';
        length = length || 2;
        while ( num.length < length ) {
            num = '0' + num;
        }
        return num;
    }

    function simpleReplace( tmpl, data, prefix, suffix ) {
        prefix = prefix || '';
        suffix = suffix || '';
        var keys = Object.keys( data );
        var regex, value;
        for ( var key = 0; key < keys.length; key++ ) {
            value = data[ keys[ key ] ];
            regex = new RegExp( prefix + keys[ key ] + suffix, 'g' );
            tmpl = tmpl.replace( regex, value );
        }
        return tmpl;
    }

    function get_time() {
        var date = new Date();
        return {
            G : date.getHours(),
            H : leadingZeros( date.getHours() ),
            i : leadingZeros( date.getMinutes() ),
            s : leadingZeros( date.getSeconds() ),
        };
    }

    function get_date() {
        var date = new Date();
        return {
            d : leadingZeros( date.getDate() ),
            j : date.getDate(),
            m : leadingZeros( date.getMonth() ),
            n : date.getMonth(),
            y : date.getFullYear().toString().substr(-2),
            Y : date.getFullYear(),
            l : new Intl.DateTimeFormat( 'de-DE', { weekday : 'long' } ).format( date ),
            F : new Intl.DateTimeFormat( 'de-DE', { month : 'long' } ).format( date ),
        };
    }

    function debounce( func, delay ) {
        delay = typeof delay === 'number' ? delay : 350;
        var timer = 0;
        return function( event ) {
            if ( timer ) {
                window.clearTimeout( timer );
                timer = 0;
            }
            timer = window.setTimeout( func, delay, event );
        };
    }

    function equalPropValues( items, cond, read, write ) {
        read = read || 'height';
        write = write || 'minHeight';

        var i, highest = 0;
        var dims = [];

        if ( cond ) {
            for ( i = 0; i < items.length; i++ ) {
                items[ i ].style[ write ] = '';
                dims[ i ] = items[ i ].getBoundingClientRect();
                if ( dims[ i ][ read ] > highest ) {
                    highest = dims[ i ][ read ];
                }
            }
        }

        for ( i = 0; i < items.length; i++ ) {
            items[ i ].style[ write ] = highest ? highest + 'px' : '';
        }
    }

    var e_clock = document.getElementById( 'clock' );
    if ( e_clock ) {
        var e_time = e_clock.querySelector( '.clock' );
        var e_date = e_clock.querySelector( '.date' );
        var date_format = e_date.getAttribute( 'data-format' );
        if ( !date_format || !date_format.length ) {
            date_format = 'l, j. F Y';
        }
        var time_format = e_time.getAttribute( 'data-format' );
        if ( !time_format || !time_format.length ) {
            time_format = 'H:i:s';
        }

        function set_time() {
            e_time.innerText = simpleReplace( time_format, get_time() );
        }

        function set_date() {
            e_date.innerText = simpleReplace( date_format, get_date() );
        }

        set_date();

        window.setInterval( set_time, 1000 );
    }

    var e_background = document.querySelector( '.background' );
    var p_background_h = e_background.getAttribute( 'data-horizontal' );
    if ( !h_align.includes( p_background_h ) ) {
        e_background.setAttribute( 'data-horizontal', h_align[ randomInt( 0, h_align.length - 1 ) ] );
    }
    var p_background_v = e_background.getAttribute( 'data-vertical' );
    if ( !v_align.includes( p_background_v ) ) {
        e_background.setAttribute( 'data-vertical', v_align[ randomInt( 0, v_align.length - 1 ) ] );
    }

    var bgs = parseInt( e_background.getAttribute( 'data-length' ) );
    if ( bgs > 1 ) {
        e_background.setAttribute( 'data-index', randomInt( 0, bgs - 1 ) );
    } else {
        e_background.setAttribute( 'data-index', 0 );
    }

    var style = document.getElementsByTagName( 'main' )[ 0 ].getAttribute( 'data-style' );
    if ( style !== 'none' ) {
        var e_groups = document.querySelectorAll( '.dashboard__group' );
        equalPropValues( e_groups, window.innerWidth > 767, 'width', 'minWidth' );
        window.addEventListener( 'resize', debounce( function() {
            equalPropValues( e_groups, window.innerWidth > 767, 'width', 'minWidth' );
        } ) );
    }
} )();
