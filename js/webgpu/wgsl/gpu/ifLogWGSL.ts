// Copyright 2024, University of Colorado Boulder

/**
 * Includes certain WGSL code only if the blueprint has logging enabled.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, wgslFunction, WGSLString } from '../../../imports.js';

const ifLogWGSL = (
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

export default ifLogWGSL;

alpenglow.register( 'ifLogWGSL', ifLogWGSL );