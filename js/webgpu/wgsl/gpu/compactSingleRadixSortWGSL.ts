// Copyright 2023-2025, University of Colorado Boulder

/**
 * Performs a full radix-sort of an array in workgroup memory (which can be of length workgroupSize * grainSize),
 * using a more complicated/computational but lower-memory approach by packing the accumulated bits (that we scan over)
 * into a more compact form (packed into either a u32/vec2u/vec3u/vec4u, depending on the bitVectorSize parameter).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import optionize from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import { alpenglow } from '../../../alpenglow.js';
import { u32S, wgsl, WGSLExpressionT, WGSLExpressionU32, WGSLStatements } from '../WGSLString.js';
import { nBitCompactSingleSortWGSL, nBitCompactSingleSortWGSLOptions } from './nBitCompactSingleSortWGSL.js';
import { commentWGSL } from './commentWGSL.js';

export type compactSingleRadixSortWGSLOptions<T> = {
  // number of bits in the key
  totalBits: number;

  // get the bits at the given index
  getBitsAtIndex: ( value: WGSLExpressionT, bitIndex: WGSLExpressionU32 ) => WGSLExpressionU32;
} & StrictOmit<nBitCompactSingleSortWGSLOptions<T>, 'getBits'>;

type SelfOptions<T> = Pick<compactSingleRadixSortWGSLOptions<T>, 'totalBits' | 'bitsPerInnerPass'>;

export const compactSingleRadixSortWGSL = <T>(
  providedOptions: compactSingleRadixSortWGSLOptions<T>
): WGSLStatements => {

  const options = optionize<compactSingleRadixSortWGSLOptions<T>, SelfOptions<T>, nBitCompactSingleSortWGSLOptions<T>>()( {
    getBits: value => providedOptions.getBitsAtIndex( value, wgsl`wrs_i` )
  }, providedOptions );

  return wgsl`
    ${commentWGSL( 'begin compact_single_radix_sort' )}
  
    for ( var wrs_i = 0u; wrs_i < ${u32S( options.totalBits )}; wrs_i += ${u32S( options.bitsPerInnerPass )} ) {
      ${nBitCompactSingleSortWGSL( options )}
  
      // NOTE: no workgroupBarrier here, we already have it in the function
    }
  
    ${commentWGSL( 'end compact_single_radix_sort' )}
  `;
};

alpenglow.register( 'compactSingleRadixSortWGSL', compactSingleRadixSortWGSL );