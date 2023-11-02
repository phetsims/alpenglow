// Copyright 2023, University of Colorado Boulder

/**
 * Performs a 2-bit radix sort of an array in workgroup memory (which can be of length workgroupSize * grainSize).
 * For simplicity, it packs bits into a vec4u.
 *
 * NOTE: This is a stable sort, but it only sorts things BASED ON ONLY TWO BITS of the key (so it's not a full sort)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./left_scan
#import ./unroll

${template( ( {
  valueType, // type (string)
  workgroupSize, // number
  grainSize, // number
  bitsScratch, // var<workgroup> array<vec4u, workgroupSize> // TODO: can bit-pack this better, especially for smaller workgroup*length sizes
  valueScratch, // var<workgroup> array<T, workgroupSize * grainSize>
  length, // expression: u32
  getTwoBits, // ( T ) => expression: u32
  earlyLoad = false, // boolean (controls whether we load the values early or late - might affect register pressure)
} ) => `
  {
    var tb_bits_vector = vec4( 0u );

    ${earlyLoad ? `
      var tb_values: array<${valueType}, ${grainSize}>;
    ` : ``}

    ${unroll( 0, grainSize, i => `
      // TODO: see if factoring out constants doesn't kill registers
      if ( ${u32( grainSize )} * local_id.x + ${u32( i )} < ${length} ) {
        let tb_value = ${valueScratch}[ ${u32( grainSize )} * local_id.x + ${u32( i )} ];
        let tb_bits = ${getTwoBits( `tb_value` )};
        tb_bits_vector[ tb_bits ]++;

        ${earlyLoad ? `
          tb_values[ ${u32( i )} ] = tb_value;
        ` : ``}
      }
    ` )}

    ${left_scan( {
      value: `tb_bits_vector`,
      scratch: bitsScratch,
      workgroupSize: workgroupSize,
      identity: `vec4( 0u )`,
      combine: ( a, b ) => `${a} + ${b}`,
      exclusive: true,
      skipLastScratch: false
    } )}

    // now tb_bits_vector holds the partial exclusive scan, but the inclusive scan is still in the array
    var tb_offset_bits_vector = ${bitsScratch}[ ${u32( workgroupSize - 1 )} ];
    let tb_offsets = vec4(
      0u,
      tb_offset_bits_vector.x,
      tb_offset_bits_vector.x + tb_offset_bits_vector.y,
      tb_offset_bits_vector.x + tb_offset_bits_vector.y + tb_offset_bits_vector.z
    );

    ${!earlyLoad ? `
      var tb_values: array<${valueType}, ${grainSize}>;

      ${unroll( 0, grainSize, i => `
        // TODO: see if factoring out constants doesn't kill registers
        tb_values[ ${u32( i )} ] = ${valueScratch}[ ${u32( grainSize )} * local_id.x + ${u32( i )} ];
      ` )}

      workgroupBarrier();
    ` : ``}

    ${unroll( 0, grainSize, i => `
      // TODO: see if factoring out constants doesn't kill registers
      if ( ${u32( grainSize )} * local_id.x + ${u32( i )} < ${length} ) {
        let tb_value = tb_values[ ${u32( i )} ];
        let tb_bits = ${getTwoBits( `tb_value` )};

        ${valueScratch}[ tb_offsets[ tb_bits ] + tb_bits_vector[ tb_bits ] ] = tb_value;

        // NOTE the increment, so that we'll write to the next location next time
        tb_bits_vector[ tb_bits ]++;
      }
    ` )}

    workgroupBarrier();
  }
` )}
