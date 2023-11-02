// Copyright 2023, University of Colorado Boulder

/**
 * Performs a 2-bit radix sort of an array in workgroup memory (no longer than the workgroup size).
 * For simplicity, it packs bits into a vec4u (two_bit_compact_workgroup_sort is more memory-efficient, but involves
 * more complexity).
 *
 * NOTE: This is a stable sort, but it only sorts things BASED ON ONLY TWO BITS of the key (so it's not a full sort)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./left_scan

${template( ( {
  inputValue, // input name
  workgroupSize, // number
  scratch, // var<workgroup> array<vec4u>
  moveTo, // ( newIndex ) => void
  length, // expression: u32
  bits, // expression: u32
} ) => `
  {
    let tb_bits = select( 4u, ${bits}, local_id.x < ${length} ); // Choose a value that won't be used
    var tb_bits_vector = vec4(
      select( 0u, 1u, tb_bits == 0u ),
      select( 0u, 1u, tb_bits == 1u ),
      select( 0u, 1u, tb_bits == 2u ),
      select( 0u, 1u, tb_bits == 3u )
    );
    // TODO: consider tb_bits_vector[ bits ] = 1u instead of 4 selects?

    ${left_scan( {
      value: `tb_bits_vector`,
      scratch: scratch,
      workgroupSize: workgroupSize,
      identity: `vec4( 0u )`,
      combine: ( a, b ) => `${a} + ${b}`,
      exclusive: true,
      skipLastScratch: false
    } )}

    // now tb_bits_vector holds the partial exclusive scan, but the inclusive scan is still in the array
    let tb_offset_bits_vector = ${scratch}[ ${u32( workgroupSize - 1 )} ];
    let tb_offsets = vec4(
      0u,
      tb_offset_bits_vector.x,
      tb_offset_bits_vector.x + tb_offset_bits_vector.y,
      tb_offset_bits_vector.x + tb_offset_bits_vector.y + tb_offset_bits_vector.z
    );

    if ( local_id.x < ${length} ) {
      ${moveTo( `tb_offsets[ tb_bits ] + tb_bits_vector[ tb_bits ]` )}
    }
  }
` )}
