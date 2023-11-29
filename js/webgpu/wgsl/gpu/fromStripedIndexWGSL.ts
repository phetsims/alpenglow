// Copyright 2023, University of Colorado Boulder

/**
 * Converts an index from a striped order to a normal (blocked) order.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, RakedSizable, u32, WGSLExpressionU32, WGSLStatements } from '../../../imports.js';

export type fromStripedIndexWGSLOptions = {
  // represents a striped index into data. So 0 is the 1st element, workgroupSIze is the 2nd element, etc.
  i: WGSLExpressionU32;
} & RakedSizable;

const fromStripedIndexWGSL = (
  options: fromStripedIndexWGSLOptions
): WGSLStatements => {
  const i = options.i;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;

  return `
    // TODO: optimizations if workgroupSize or grainSize is 1
    (
      ( ( ${i} ) / ${u32( workgroupSize * grainSize )} ) * ${u32( workgroupSize * grainSize )} +
      ( ( ${i} ) % ${u32( workgroupSize )} ) * ${u32( grainSize )} +
      ( ( ( ${i} ) % ${u32( workgroupSize * grainSize )} ) / ${u32( workgroupSize )} )
    )
  `.split( '\n' ).map( s => s.trim() ).join( ' ' );
};

export default fromStripedIndexWGSL;

alpenglow.register( 'fromStripedIndexWGSL', fromStripedIndexWGSL );
