// Copyright 2023, University of Colorado Boulder

/**
 * Performs a N-bit radix sort of an array in workgroup memory (which can be of length workgroupSize * grainSize),
 * using a more complicated/computational but lower-memory approach by packing the accumulated bits (that we scan over)
 * into a more compact form (packed into either a u32/vec2u/vec3u/vec4u, depending on the bitVectorSize parameter).
 *
 * NOTE: This is a stable sort, but it only sorts things BASED ON ONLY N (bitQuantity) BITS of the key (so it's not a
 * full sort). You'll want to run this multiple times (giving different sections of bits each time, from lower to higher)
 * in order to achieve a full sort.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./bit_pack_radix_access
#import ./bit_pack_radix_exclusive_scan
#import ./bit_pack_radix_increment
#import ./scan
#import ./unroll
#import ./log

${template( ( {
  valueType, // type (string)
  workgroupSize, // number
  grainSize, // number
  bitQuantity, // number - the number of bits we're using for the sort (e.g. 2 for a two_bit equivalent sort)
  bitVectorSize, // number - (1/2/3/4) for (u32/vec2u/vec3u/vec4u) e.g. 4 for a vec4u - whatever is in bitsScratch
  bitsScratch, // var<workgroup> array<u32|vec2u|vec3u|vec4u, workgroupSize> TODO: we can pack this more efficiently, no?
  valueScratch, // var<workgroup> array<T, workgroupSize * grainSize>
  length, // expression: u32
  getBits, // ( T ) => expression: u32
  earlyLoad = false, // boolean (controls whether we load the values early or late - might affect register pressure)
} ) => {
  const log_packed_bits = ( name, varName ) => log( {
    name: `${name} (countBitQuantity: ${Math.ceil( Math.log2( workgroupSize * grainSize ) )})`,
    dataLength: bitVectorSize,
    writeU32s: ( arr, offset ) => `
      ${{
        1: `
          ${arr}[ ${offset} ] = ${varName};
        `,
        2: `
          ${arr}[ ${offset} + 0u ] = ${varName}.x;
          ${arr}[ ${offset} + 1u ] = ${varName}.y;
        `,
        3: `
          ${arr}[ ${offset} + 0u ] = ${varName}.x;
          ${arr}[ ${offset} + 1u ] = ${varName}.y;
          ${arr}[ ${offset} + 2u ] = ${varName}.z;
        `,
        4: `
          ${arr}[ ${offset} + 0u ] = ${varName}.x;
          ${arr}[ ${offset} + 1u ] = ${varName}.y;
          ${arr}[ ${offset} + 2u ] = ${varName}.z;
          ${arr}[ ${offset} + 3u ] = ${varName}.w;
        `
      }[ bitVectorSize ]}
    `,
    deserialize: arr => [ ...arr ].map( value => {
      const countBitQuantity = Math.ceil( Math.log2( workgroupSize * grainSize ) );
      const countsPerComponent = Math.floor( 32 / countBitQuantity );

      return [
        // raw
        ByteEncoder.toU32Hex( value ),
        ...( _.range( 0, countsPerComponent ).map( i => {
          const start = i * countBitQuantity;
          const end = ( i + 1 ) * countBitQuantity;
          return ( value >> start ) & ( ( 1 << countBitQuantity ) - 1 );
        } ) )
      ];
    } ),
    lineToLog: ConsoleLoggedLine.toLogExisting,
  } );

  return `
    ${comment( 'begin n_bit_compact_single_sort' )}

    ${log( {
      name: `n_bit_compact_single_sort workgroupSize:${workgroupSize}, grainSize:${grainSize}, bitQuantity:${bitQuantity}, bitVectorSize:${bitVectorSize}, length:"${length}" earlyLoad:${earlyLoad}`,
    } )}

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

      // Store our thread's "raked" values histogram into tb_bits_vector
      ${unroll( 0, grainSize, i => `
        // TODO: see if factoring out constants doesn't kill registers
        if ( ${u32( grainSize )} * local_id.x + ${u32( i )} < ${length} ) {
          let tb_value = ${valueScratch}[ ${u32( grainSize )} * local_id.x + ${u32( i )} ];
          let tb_bits = ${getBits( `tb_value` )};

          ${log( {
            name: `tb_bits (raked index ${i})`,
            dataLength: 1,
            writeU32s: ( arr, offset ) => `${arr}[ ${offset} ] = tb_bits;`,
            deserialize: arr => arr[ 0 ],
          } )}

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

      ${log_packed_bits( 'n_bit histogram initial', `tb_bits_vector` )}

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

      ${log_packed_bits( 'n_bit histogram scanned', `tb_bits_vector` )}

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
  `;
} )}
