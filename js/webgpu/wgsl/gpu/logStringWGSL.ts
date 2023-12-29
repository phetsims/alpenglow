// Copyright 2023, University of Colorado Boulder

/**
 * Provides the ability to log a string out
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, logWGSL, PipelineBlueprint, WGSLStatements } from '../../../imports.js';

const logStringWGSL = (
  blueprint: PipelineBlueprint,
  str: string
): WGSLStatements => logWGSL( blueprint, {
  name: str
} );

export default logStringWGSL;

alpenglow.register( 'logStringWGSL', logStringWGSL );
