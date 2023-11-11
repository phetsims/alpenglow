// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./n_bit_compact_single_sort

${template( ( {
  valueType, // type (string)
  workgroupSize, // number
  grainSize, // number
  numBits, // number - number of bits in the key
  bitQuantity, // number - the number of bits we're using for the sort (e.g. 2 for a two_bit equivalent sort)
  bitVectorSize, // number - (1/2/3/4) for (u32/vec2u/vec3u/vec4u) e.g. 4 for a vec4u - whatever is in bitsScratch
  bitsScratch, // var<workgroup> array<vec4u, workgroupSize> // TODO: can bit-pack this better, especially for smaller workgroup*length sizes
  valueScratch, // var<workgroup> array<T, workgroupSize>
  length, // expression: u32
  getBits, // ( T, bitIndex: u32 expr ) => expression: u32
  earlyLoad, // boolean (controls whether we load the values early or late - might affect register pressure)
} ) => `
  ${comment( 'begin compact_single_radix_sort' )}

  for ( var wrs_i = 0u; wrs_i < ${u32( numBits )}; wrs_i += ${u32( bitQuantity )} ) {
    ${n_bit_compact_single_sort( {
      valueType: valueType,
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      bitQuantity: bitQuantity,
      bitVectorSize: bitVectorSize,
      bitsScratch: bitsScratch,
      valueScratch: valueScratch,
      length: length,
      getBits: value => getBits( value, `wrs_i` ),
      earlyLoad: earlyLoad,
    } )}

    // NOTE: no workgroupBarrier here, we already have it in the function
  }

  ${comment( 'end compact_single_radix_sort' )}
` )}
