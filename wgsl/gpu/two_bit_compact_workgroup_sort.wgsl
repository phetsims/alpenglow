// Copyright 2023, University of Colorado Boulder

/**
 * Performs a 2-bit radix sort of an array in workgroup memory (no longer than the workgroup size),
 * but unlike two_bit_workgroup_sort, this one uses a more complicated/computational but lower-memory approach by
 * packing the accumulated bits (that we scan over) into a more compact form (all stored in a single u32 in this case).
 *
 * NOTE: This is a stable sort, but it only sorts things BASED ON ONLY TWO BITS of the key (so it's not a full sort)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./bit_pack_radix_access
#import ./bit_pack_radix_exclusive_scan
#import ./bit_pack_radix_increment
#import ./scan

${template( ( {
  inputValue, // input name
  workgroupSize, // number (256 max here)
  scratch, // var<workgroup> array<u32>
  moveTo, // ( newIndex ) => void
  length, // expression: u32
  bits, // expression: u32
} ) => `
  ${comment( 'begin two_bit_compact_workgroup_sort' )}

  {
    var tb_bits_vector = 0u;

    if ( local_id.x < ${length} ) {
      ${bit_pack_radix_increment( {
        bitVector: `tb_bits_vector`,
        bits: bits,
        bitQuantity: 2,
        bitVectorSize: 1,
        maxCount: workgroupSize
      } )}
    }

    ${scan( {
      value: `tb_bits_vector`,
      scratch: scratch,
      workgroupSize: workgroupSize,
      identity: `0u`,
      combineExpression: ( a, b ) => `${a} + ${b}`,
      exclusive: true,
      needsValidScratch: true
    } )}

    // now tb_bits_vector holds the partial exclusive scan, but the inclusive scan is still in the array
    var tb_offsets = ${scratch}[ ${u32( workgroupSize - 1 )} ];

    ${bit_pack_radix_exclusive_scan( {
      bitVector: `tb_offsets`,
      bitQuantity: 2,
      bitVectorSize: 1,
      maxCount: workgroupSize
    } )}

    if ( local_id.x < ${length} ) {
      // TODO: a way to compute the index and access both of these efficiently?
      ${moveTo( `( ${bit_pack_radix_access( {
        bitVector: `tb_offsets`,
        bits: bits,
        bitQuantity: 2,
        bitVectorSize: 1,
        maxCount: workgroupSize
      } )} ) + ( ${bit_pack_radix_access( {
        bitVector: `tb_bits_vector`,
        bits: bits,
        bitQuantity: 2,
        bitVectorSize: 1,
        maxCount: workgroupSize
      } )} )` )}
    }
  }

  ${comment( 'end two_bit_compact_workgroup_sort' )}
` )}
