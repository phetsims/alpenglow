// Copyright 2023-2026, University of Colorado Boulder

/**
 * Accesses a count from within a bit-packed histogram. This is used for memory-efficient in-workgroup-memory sorting.
 *
 * Main documentation for the bit-packing pattern and rationale:
 *
 * Naively, we can store counts in a vec4 (similar to
 * https://betterprogramming.pub/memory-bandwidth-optimized-parallel-radix-sort-in-metal-for-apple-m1-and-beyond-4f4590cfd5d3).
 * However, we're using a u32 for each count, and it's taking up a lot of workgroup memory to store these counts
 * (16 bytes per thread). If our count only takes N bits, we can store up to floor( 32 / N ) counts in a single u32,
 * and with a vector size M (M=1 is u32, M=2 is vec2u, M=3 is vec3u, M=4 is vec4u), we can thus store up to
 * M * floor( 32 / N ) counts efficiently. NOTE that it might be possible to pack things even tighter, but it would
 * involve a single count being spread across different vector components, so we skip that.
 *
 * E.g. if we have a simple 2-bit sort with workgroupSize=256 (8 bit counts), we can pack all of these into a single u32, e.g.
 * count0 | ( count1 << 8 ) | ( count2 << 16 ) | ( count3 << 24 )
 *
 * E.g. if we have a 3-bit sort (8 bins) with a possible count of 1024 (10 bit counts), we'll have:
 * vec3(
 *   count0 | ( count1 << 10 ) | ( count2 << 20 ),
 *   count3 | ( count4 << 10 ) | ( count5 << 20 ),
 *   count6 | ( count7 << 10 )
 * )
 *
 * TODO: We could actually have the bitVector workgroup variable be shorter(!) since a lot of the time we don't need
 * TODO: that much memory. ACTUALLY this depends on... the length? Likely unless we know our data is shorter, this is
 * TODO: NOT the case
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../../alpenglow.js';
import { u32S, wgsl, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../WGSLString.js';

export type bitPackRadixAccessWGSLOptions = {
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

export const bitPackRadixAccessWGSL = (
  options: bitPackRadixAccessWGSLOptions
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

  return wgsl`${
    // Opening paren needed if we have multiple components each
    countsPerComponent === 1 ? wgsl`` : wgsl`( `
  }${bitVector}${bitVectorSize > 1 ? wgsl`[ ${
    // Our access index (if we're a vector)
    countsPerComponent === 1 ? bits : wgsl`( ${bits} ) / ${u32S( countsPerComponent )}`
  } ]` : wgsl``}${
    // If we have multiple components, we'll need to bit shift and &
    countsPerComponent === 1 ? wgsl`` : wgsl` >> ( ( ( ${bits} ) % ${u32S( countsPerComponent )} ) * ${u32S( countBitQuantity )} ) ) & ${u32S( ( 1 << countBitQuantity ) - 1 )}`
  }`;
};

alpenglow.register( 'bitPackRadixAccessWGSL', bitPackRadixAccessWGSL );