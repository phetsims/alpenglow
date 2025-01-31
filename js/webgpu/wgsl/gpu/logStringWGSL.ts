// Copyright 2023-2025, University of Colorado Boulder

/**
 * Provides the ability to log a string out
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../../alpenglow.js';
import { WGSLStatements } from '../WGSLString.js';
import { logWGSL } from './logWGSL.js';

export const logStringWGSL = (
  str: string
): WGSLStatements => logWGSL( {
  name: str
} );

alpenglow.register( 'logStringWGSL', logStringWGSL );