// Copyright 2023, University of Colorado Boulder

/**
 * Converts an index from a normal (blocked) order to a striped order (for improved memory coherence).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, u32, WGSLExpressionU32, WGSLStatements } from '../../imports.js';

export type toStripedIndexWGSLOptions = {
  // represents a normal (blocked) index into data. So 0 is the 1st element, 1 is the 2nd, etc.
  i: WGSLExpressionU32;

  workgroupSize: number;
  grainSize: number;
};

const toStripedIndexWGSL = (
  options: toStripedIndexWGSLOptions
): WGSLStatements => {
  const i = options.i;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;

  return `
    // TODO: optimizations if workgroupSize or grainSize is 1
    (
      ( ( ${i} ) / ${u32( workgroupSize * grainSize )} ) * ${u32( workgroupSize * grainSize )} +
      ( ( ${i} ) % ${u32( grainSize )} ) * ${u32( workgroupSize )} +
      ( ( ( ${i} ) % ${u32( workgroupSize * grainSize )} ) / ${u32( grainSize )} )
    )
  `.split( '\n' ).map( s => s.trim() ).join( ' ' );
};

export default toStripedIndexWGSL;

alpenglow.register( 'toStripedIndexWGSL', toStripedIndexWGSL );
