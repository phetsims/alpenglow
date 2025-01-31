// Copyright 2023-2025, University of Colorado Boulder

/**
 * Support for adding in comments to the resulting generated shader code that won't get removed by
 * the typical process that removes comments. Useful for noting templates used, or really anything else that can
 * benefit from seeing debugging comments in the generated shader code.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../../alpenglow.js';
import { wgsl, wgslString, WGSLString } from '../WGSLString.js';

export const commentWGSL = (
  str: string
): WGSLString => {
  return wgsl`/*** ${wgslString( str )} ***/`;
};

alpenglow.register( 'commentWGSL', commentWGSL );