// Copyright 2024-2025, University of Colorado Boulder

/**
 * Includes certain WGSL code only if the blueprint has logging enabled.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../../alpenglow.js';
import { wgslFunction, WGSLString } from '../WGSLString.js';

export const ifLogWGSL = (
  string: WGSLString
): WGSLString => {
  return wgslFunction( blueprint => {
    if ( blueprint.log ) {
      return string.withBlueprint( blueprint );
    }
    else {
      return '';
    }
  } );
};

alpenglow.register( 'ifLogWGSL', ifLogWGSL );