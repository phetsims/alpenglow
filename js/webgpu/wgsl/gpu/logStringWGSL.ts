// Copyright 2023, University of Colorado Boulder

/**
 * Provides the ability to log a string out
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, logWGSL, WGSLContext, WGSLStatements } from '../../../imports.js';

const logStringWGSL = (
  context: WGSLContext,
  str: string
): WGSLStatements => logWGSL( context, {
  name: str
} );

export default logStringWGSL;

alpenglow.register( 'logStringWGSL', logStringWGSL );
