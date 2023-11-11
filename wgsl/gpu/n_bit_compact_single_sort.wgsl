// Copyright 2023, University of Colorado Boulder

/**
 * TODO: docs
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./bit_pack_radix_access
#import ./bit_pack_radix_exclusive_scan
#import ./bit_pack_radix_increment
#import ./scan
#import ./unroll

${template( ( {
  valueType, // type (string)
  workgroupSize, // number
  grainSize, // number
  bitQuantity, // number - the number of bits we're using for the sort (e.g. 2 for a two_bit equivalent sort)
  bitVectorSize, // number - (1/2/3/4) for (u32/vec2u/vec3u/vec4u) e.g. 4 for a vec4u - whatever is in bitsScratch
  bitsScratch, // var<workgroup> array<u32|vec2u|vec3u|vec4u, workgroupSize>
  valueScratch, // var<workgroup> array<T, workgroupSize * grainSize>
  length, // expression: u32
  getBits, // ( T ) => expression: u32
  earlyLoad = false, // boolean (controls whether we load the values early or late - might affect register pressure)
} ) => `
  ${comment( 'begin n_bit_compact_single_sort' )}

  {
    var tb_bits_vector = ${{
      1: '0u',
      2: 'vec2( 0u )',
      3: 'vec3( 0u )',
      4: 'vec4( 0u )'
    }[ bitVectorSize ]};

    ${earlyLoad ? `
      var tb_values: array<${valueType}, ${grainSize}>;
    ` : ``}

    ${unroll( 0, grainSize, i => `
      // TODO: see if factoring out constants doesn't kill registers
      if ( ${u32( grainSize )} * local_id.x + ${u32( i )} < ${length} ) {
        let tb_value = ${valueScratch}[ ${u32( grainSize )} * local_id.x + ${u32( i )} ];
        let tb_bits = ${getBits( `tb_value` )};

        ${bit_pack_radix_increment( {
          bitVector: `tb_bits_vector`,
          bits: `tb_bits`,
          bitQuantity: bitQuantity,
          bitVectorSize: bitVectorSize,
          maxCount: workgroupSize * grainSize
        } )}

        ${earlyLoad ? `
          tb_values[ ${u32( i )} ] = tb_value;
        ` : ``}
      }
    ` )}

    ${scan( {
      value: `tb_bits_vector`,
      scratch: bitsScratch,
      workgroupSize: workgroupSize,
      identity: {
        1: `0u`,
        2: `vec2( 0u )`,
        3: `vec3( 0u )`,
        4: `vec4( 0u )`
      }[ bitVectorSize ],
      combineExpression: ( a, b ) => `${a} + ${b}`,
      exclusive: true,
      needsValidScratch: true
    } )}

    // now tb_bits_vector holds the partial exclusive scan, but the inclusive scan is still in the array
    var tb_offsets = ${bitsScratch}[ ${u32( workgroupSize - 1 )} ];

    ${bit_pack_radix_exclusive_scan( {
      bitVector: `tb_offsets`,
      bitQuantity: bitQuantity,
      bitVectorSize: bitVectorSize,
      maxCount: workgroupSize * grainSize
    } )}

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
        let tb_bits = ${getBits( `tb_value` )};

        // TODO: a way to compute the index and access both of these efficiently?
        ${valueScratch}[ ( ${bit_pack_radix_access( {
          bitVector: `tb_offsets`,
          bits: `tb_bits`,
          bitQuantity: bitQuantity,
          bitVectorSize: bitVectorSize,
          maxCount: workgroupSize * grainSize
        } )} ) + ( ${bit_pack_radix_access( {
          bitVector: `tb_bits_vector`,
          bits: `tb_bits`,
          bitQuantity: bitQuantity,
          bitVectorSize: bitVectorSize,
          maxCount: workgroupSize * grainSize
        } )} ) ] = tb_value;

        // NOTE the increment, so that we'll write to the next location next time
        ${bit_pack_radix_increment( {
          bitVector: `tb_bits_vector`,
          bits: `tb_bits`,
          bitQuantity: bitQuantity,
          bitVectorSize: bitVectorSize,
          maxCount: workgroupSize * grainSize
        } )}
      }
    ` )}

    workgroupBarrier();
  }

  ${comment( 'end n_bit_compact_single_sort' )}
` )}
