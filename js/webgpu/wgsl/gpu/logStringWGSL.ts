// Copyright 2023-2024, University of Colorado Boulder

/**
 * Provides the ability to log a string out
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, logWGSL, WGSLStatements } from '../../../imports.js';

const logStringWGSL = (
  str: string
): WGSLStatements => logWGSL( {
  name: str
} );

export default logStringWGSL;

alpenglow.register( 'logStringWGSL', logStringWGSL );