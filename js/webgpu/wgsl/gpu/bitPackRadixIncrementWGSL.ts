// Copyright 2023-2025, University of Colorado Boulder

/**
 * Increments a count from within a bit-packed histogram. See bit_pack_radix_access for more documentation.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../../alpenglow.js';
import { u32S, wgsl, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../WGSLString.js';

export type bitPackRadixIncrementWGSLOptions = {
  // u32 name
  bits: WGSLExpressionU32;

  // (u32/vec2u/vec3u/vec4u) name
  bitVector: WGSLVariableName;

  // TODO: once this is working, form it into a larger object of settings for Radix handling
  // e.g. 2 for a two-bit sort
  bitsPerInnerPass: number;

  // (1/2/3/4) for (u32/vec2u/vec3u/vec4u) e.g. 4 for a vec4u
  bitVectorSize: number;

  // the maximum count in the histogram
  maxCount: number;
};

export const bitPackRadixIncrementWGSL = (
  options: bitPackRadixIncrementWGSLOptions
): WGSLStatements => {

  const bitVector = options.bitVector;
  const bits = options.bits;
  const bitsPerInnerPass = options.bitsPerInnerPass;
  const bitVectorSize = options.bitVectorSize;
  const maxCount = options.maxCount;

  // TODO: code share with other components(!)
  const countBitQuantity = Math.ceil( Math.log2( maxCount ) );
  const countsPerComponent = Math.floor( 32 / countBitQuantity );
  assert && assert( bitVectorSize * countsPerComponent >= ( 1 << bitsPerInnerPass ), 'Not enough space for bit-packing' );

  return wgsl`
    ${bitVector}${bitVectorSize > 1 ? wgsl`[ ${
      countsPerComponent === 1 ? bits : wgsl`( ${bits} ) / ${u32S( countsPerComponent )}`
    } ]` : wgsl``} += 1u${countsPerComponent === 1 ? wgsl`` : wgsl` << ( ( ( ${bits} ) % ${u32S( countsPerComponent )} ) * ${u32S( countBitQuantity )} )`};
  `;
};

alpenglow.register( 'bitPackRadixIncrementWGSL', bitPackRadixIncrementWGSL );