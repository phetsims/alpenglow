// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./two_bit_single_sort

${template( ( {
  valueType, // type (string)
  workgroupSize, // number
  grainSize, // number
  numBits, // number
  bitsScratch, // var<workgroup> array<vec4u, workgroupSize> // TODO: can bit-pack this better, especially for smaller workgroup*length sizes
  valueScratch, // var<workgroup> array<T, workgroupSize>
  length, // expression: u32
  getTwoBits, // ( T, bitIndex: u32 expr ) => expression: u32
  earlyLoad, // boolean (controls whether we load the values early or late - might affect register pressure)
} ) => `
  for ( var wrs_i = 0u; wrs_i < ${u32( numBits )}; wrs_i += 2u ) {
    ${two_bit_single_sort( {
      valueType: valueType,
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      bitsScratch: bitsScratch,
      valueScratch: valueScratch,
      length: length,
      getTwoBits: value => getTwoBits( value, `wrs_i` ),
      earlyLoad: earlyLoad,
    } )}

    // NOTE: no workgroupBarrier here, we already have it in the function
  }
` )}
