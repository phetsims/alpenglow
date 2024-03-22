// Copyright 2023-2024, University of Colorado Boulder

/**
 * Converts an index from a normal (blocked) order to a striped order (for improved memory coherence).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, RakedSizable, u32S, wgsl, WGSLExpressionU32, wgslOneLine, WGSLStatements } from '../../../imports.js';

export type toStripedIndexWGSLOptions = {
  // represents a normal (blocked) index into data. So 0 is the 1st element, 1 is the 2nd, etc.
  i: WGSLExpressionU32;
} & RakedSizable;

const toStripedIndexWGSL = (
  options: toStripedIndexWGSLOptions
): WGSLStatements => {
  const i = options.i;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;

  return wgslOneLine( wgsl`
    // TODO: optimizations if workgroupSize or grainSize is 1
    (
      ( ( ${i} ) / ${u32S( workgroupSize * grainSize )} ) * ${u32S( workgroupSize * grainSize )} +
      ( ( ${i} ) % ${u32S( grainSize )} ) * ${u32S( workgroupSize )} +
      ( ( ( ${i} ) % ${u32S( workgroupSize * grainSize )} ) / ${u32S( grainSize )} )
    )
  ` );
};

export default toStripedIndexWGSL;

alpenglow.register( 'toStripedIndexWGSL', toStripedIndexWGSL );