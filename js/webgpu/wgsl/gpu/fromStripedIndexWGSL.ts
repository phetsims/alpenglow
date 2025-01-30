// Copyright 2023-2024, University of Colorado Boulder

/**
 * Converts an index from a striped order to a normal (blocked) order.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../../alpenglow.js';
import { u32S, wgsl, WGSLExpressionU32, wgslOneLine, WGSLStatements } from '../WGSLString.js';
import { RakedSizable } from '../WGSLUtils.js';

export type fromStripedIndexWGSLOptions = {
  // represents a striped index into data. So 0 is the 1st element, workgroupSIze is the 2nd element, etc.
  i: WGSLExpressionU32;
} & RakedSizable;

export const fromStripedIndexWGSL = (
  options: fromStripedIndexWGSLOptions
): WGSLStatements => {
  const i = options.i;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;

  return wgslOneLine( wgsl`
    // TODO: optimizations if workgroupSize or grainSize is 1
    (
      ( ( ${i} ) / ${u32S( workgroupSize * grainSize )} ) * ${u32S( workgroupSize * grainSize )} +
      ( ( ${i} ) % ${u32S( workgroupSize )} ) * ${u32S( grainSize )} +
      ( ( ( ${i} ) % ${u32S( workgroupSize * grainSize )} ) / ${u32S( workgroupSize )} )
    )
  ` );
};

alpenglow.register( 'fromStripedIndexWGSL', fromStripedIndexWGSL );