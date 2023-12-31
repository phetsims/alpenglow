// Copyright 2023, University of Colorado Boulder

/**
 * Increments a count from within a bit-packed histogram. See bit_pack_radix_access for more documentation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, u32, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../../../imports.js';

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

const bitPackRadixIncrementWGSL = (
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

  return `
    ${bitVector}${bitVectorSize > 1 ? `[ ${
      countsPerComponent === 1 ? bits : `( ${bits} ) / ${u32( countsPerComponent )}`
    } ]` : ''} += 1u${countsPerComponent === 1 ? '' : ` << ( ( ( ${bits} ) % ${u32( countsPerComponent )} ) * ${u32( countBitQuantity )} )`};
  `;
};

export default bitPackRadixIncrementWGSL;

alpenglow.register( 'bitPackRadixIncrementWGSL', bitPackRadixIncrementWGSL );
