  // Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./two_bit_workgroup_sort

${template( ( {
  value, // input name (already exists)
  workgroupSize, // number
  numBits, // number
  bitsScratch, // var<workgroup> array<vec4u> // TODO: can bit-pack this better, especially for smaller workgroup*length sizes
  valueScratch, // var<workgroup> array<T>
  length, // expression: u32
  getTwoBits, // ( T, bitIndex: u32 expr ) => expression: u32
} ) => `
  for ( var wrs_i = 0u; wrs_i < ${u32( numBits )}; wrs_i += 2u ) {
    let wrs_bits = ${getTwoBits( value, `wrs_i` )};

    ${two_bit_workgroup_sort( {
      inputValue: value,
      workgroupSize: workgroupSize,
      scratch: bitsScratch,
      moveTo: newIndex => `${valueScratch}[ ${newIndex} ] = ${value};`,
      length: length,
      bits: `wrs_bits`
    } )}

    workgroupBarrier();

    if ( local_id.x < ${length} ) {
      ${value} = ${valueScratch}[ local_id.x ];
    }
  }
` )}
