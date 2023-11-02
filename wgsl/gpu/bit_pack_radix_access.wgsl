// Copyright 2023, University of Colorado Boulder

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
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( ( {
  bitVector, // (u32/vec2u/vec3u/vec4u) name
  bits, // u32 name
  bitQuantity, // e.g. 2 for a two-bit sort
  bitVectorSize, // (1/2/3/4) for (u32/vec2u/vec3u/vec4u) e.g. 4 for a vec4u
  maxCount, // the maximum count in the histogram
} ) => {
  const countBitQuantity = Math.ceil( Math.log2( maxCount ) );
  const countsPerComponent = Math.floor( 32 / countBitQuantity );
  assert && assert( bitVectorSize * countsPerComponent >= bitQuantity, 'Not enough space for bit-packing' );

  return `${
    // Opening paren needed if we have multiple components each
    countsPerComponent === 1 ? `` : `( `
  }${bitVector}${bitVectorSize > 1 ? `[ ${
    // Our access index (if we're a vector)
    countsPerComponent === 1 ? bits : `( ${bits} ) / ${u32( countsPerComponent )}`
  } ]` : ``}${
    // If we have multiple components, we'll need to bit shift and &
    countsPerComponent === 1 ? `` : ` >> ( ( ( ${bits} ) % ${u32( countsPerComponent )} ) * ${u32( countBitQuantity )} ) ) & ${u32( ( 1 << countBitQuantity ) - 1 )}`
  }`;
} )}
