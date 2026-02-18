// Copyright 2023-2026, University of Colorado Boulder

/**
 * The main 'alpenglow' namespace object for the exported (non-Require.js) API. Used internally
 * since it prevents Require.js issues with circular dependencies.
 *
 * The returned alpenglow object namespace may be incomplete if not all modules are listed as
 * dependencies. Please use the 'main' module for that purpose if all of Kite is desired.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Namespace from '../../phet-core/js/Namespace.js';

const alpenglow = new Namespace( 'alpenglow' );

// will be filled in by other modules
export { alpenglow };