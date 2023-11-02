// Copyright 2023, University of Colorado Boulder

/**
 * Increments a count from within a bit-packed histogram. See bit_pack_radix_access for more documentation.
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

  return `
    ${bitVector}${bitVectorSize > 1 ? `[ ${
      countsPerComponent === 1 ? bits : `( ${bits} ) / ${u32( countsPerComponent )}`
    } ]` : ``} += 1u${countsPerComponent === 1 ? `` : ` << ( ( ( ${bits} ) % ${u32( countsPerComponent )} ) * ${u32( countBitQuantity )} )`};
  `;
} )}
