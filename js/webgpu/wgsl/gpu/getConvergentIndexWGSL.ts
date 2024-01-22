// Copyright 2023, University of Colorado Boulder

/**
 * Returns the bit-reversed version of the given value, such that it is sufficient for the convergent-indexed reduce.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, u32S, wgsl, WGSLExpressionU32, WGSLStatements } from '../../../imports.js';

export type getConvergentIndexWGSLOptions = {
  i: WGSLExpressionU32;
  size: number;
};

const getConvergentIndexWGSL = (
  options: getConvergentIndexWGSLOptions
): WGSLStatements => {
  const i = options.i;
  const size = options.size;

  return wgsl`( reverseBits( ${i} ) >> ${u32S( 32 - Math.log2( size ) )} )`;
};

export default getConvergentIndexWGSL;

alpenglow.register( 'getConvergentIndexWGSL', getConvergentIndexWGSL );

export const toConvergentIndexWGSL = getConvergentIndexWGSL;

alpenglow.register( 'toConvergentIndexWGSL', toConvergentIndexWGSL );

export const fromConvergentIndexWGSL = getConvergentIndexWGSL;

alpenglow.register( 'fromConvergentIndexWGSL', fromConvergentIndexWGSL );