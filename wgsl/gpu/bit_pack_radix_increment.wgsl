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

  // local variables TODO should we have a better pattern for this?
  _countBitQuantity,
  _countsPerComponent,
} ) => `
  ${( () => {
    _countBitQuantity = Math.ceil( Math.log2( maxCount ) );
    _countsPerComponent = Math.floor( 32 / _countBitQuantity );
    assert && assert( bitVectorSize * _countsPerComponent >= bitQuantity, 'Not enough space for bit-packing' );
    return '';
  } )()}

  ${bitVector}${bitVectorSize > 1 ? `[ ${
    _countsPerComponent === 1 ? bits : `( ${bits} ) / ${u32( _countsPerComponent )}`
  } ]` : ``} += 1u${_countsPerComponent === 1 ? `` : ` << ( ( ( ${bits} ) % ${u32( _countsPerComponent )} ) * ${u32( _countBitQuantity )} )`};
` )}
