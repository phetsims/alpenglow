// Copyright 2023-2026, University of Colorado Boulder

// @author Jonathan Olson (PhET Interactive Simulations)

import '../../axon/js/main.js';
import '../../dot/js/main.js';
import '../../kite/js/main.js';
import '../../phet-core/js/main.js';
import '../../utterance-queue/js/main.js';
import './main.js';

if ( !window.hasOwnProperty( '_' ) ) {
  throw new Error( 'Underscore/Lodash not found: _' );
}

phet.alpenglow.Utils.polyfillRequestAnimationFrame();