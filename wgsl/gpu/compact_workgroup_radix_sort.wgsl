// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./two_bit_compact_workgroup_sort

${template( ( {
  value, // input name (already exists)
  workgroupSize, // number
  numBits, // number - number of bits in the key
  bitsScratch, // var<workgroup> array<u32, workgroupSize>
  valueScratch, // var<workgroup> array<T, workgroupSize>
  length, // expression: u32
  getTwoBits, // ( T, bitIndex: u32 expr ) => expression: u32
} ) => `
  ${comment( 'begin compact_workgroup_radix_sort' )}

  for ( var wrs_i = 0u; wrs_i < ${u32( numBits )}; wrs_i += 2u ) {
    let wrs_bits = ${getTwoBits( value, `wrs_i` )};

    ${two_bit_compact_workgroup_sort( {
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

  ${comment( 'end compact_workgroup_radix_sort' )}
` )}
