// Copyright 2023-2024, University of Colorado Boulder

/**
 * Performs a N-bit radix sort of an array in workgroup memory (which can be of length workgroupSize * grainSize),
 * using a more complicated/computational but lower-memory approach by packing the accumulated bits (that we scan over)
 * into a more compact form (packed into either a u32/vec2u/vec3u/vec4u, depending on the bitVectorSize parameter).
 *
 * NOTE: This is a stable sort, but it only sorts things BASED ON ONLY N (bitsPerInnerPass) BITS of the key (so it's not a
 * full sort). You'll want to run this multiple times (giving different sections of bits each time, from lower to higher)
 * in order to achieve a full sort.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BitOrder, bitPackRadixAccessWGSL, bitPackRadixExclusiveScanWGSL, bitPackRadixIncrementWGSL, commentWGSL, ConsoleLoggedLine, LOCAL_INDEXABLE_DEFAULTS, LocalIndexable, logStringWGSL, logValueWGSL, logWGSL, RakedSizable, scanWGSL, u32, U32Add, U32Type, unrollWGSL, Vec2uAdd, Vec2uType, Vec3uAdd, Vec3uType, Vec4uAdd, Vec4uType, PipelineBlueprint, WGSLExpressionT, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type nBitCompactSingleSortWGSLOptions<T> = {
  // Currently mostly used for the type, but we might be able to use it for more later. (TODO)
  order: BitOrder<T>;

  // var<workgroup> array<u32|vec2u|vec3u|vec4u, workgroupSize> TODO: we can pack this more efficiently, no?
  bitsScratch: WGSLVariableName;

  // var<workgroup> array<T, workgroupSize * grainSize>
  valueScratch: WGSLVariableName;

  lengthExpression: ( pipeline: PipelineBlueprint ) => WGSLExpressionU32; // TODO: support null?

  getBits: ( value: WGSLExpressionT ) => WGSLExpressionU32;

  // (controls whether we load the values early or late - might affect register pressure)
  earlyLoad?: boolean;

  // e.g. 2 for a two-bit sort
  bitsPerInnerPass: number;

  // (1/2/3/4) for (u32/vec2u/vec3u/vec4u) e.g. 4 for a vec4u
  bitVectorSize: number;
} & RakedSizable & LocalIndexable;

const DEFAULT_OPTIONS = {
  earlyLoad: false,
  ...LOCAL_INDEXABLE_DEFAULTS // eslint-disable-line no-object-spread-on-non-literals
} as const;

const nBitCompactSingleSortWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: nBitCompactSingleSortWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<nBitCompactSingleSortWGSLOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

  const order = options.order;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const localIndex = options.localIndex;
  const bitsScratch = options.bitsScratch;
  const valueScratch = options.valueScratch;
  const lengthExpression = options.lengthExpression;
  const getBits = options.getBits;
  const earlyLoad = options.earlyLoad;
  const bitsPerInnerPass = options.bitsPerInnerPass;
  const bitVectorSize = options.bitVectorSize as ( 1 | 2 | 3 | 4 );

  assert && assert( bitVectorSize === 1 || bitVectorSize === 2 || bitVectorSize === 3 || bitVectorSize === 4 );

  const bitType = {
    1: U32Type,
    2: Vec2uType,
    3: Vec3uType,
    4: Vec4uType
  }[ bitVectorSize ];

  const addBinaryOp = {
    1: U32Add,
    2: Vec2uAdd,
    3: Vec3uAdd,
    4: Vec4uAdd
  }[ bitVectorSize ];

  const logPackedBits = <T>( name: string, varName: WGSLVariableName ) => logWGSL<T>( blueprint, {
    name: `${name} (countBitQuantity: ${Math.ceil( Math.log2( workgroupSize * grainSize ) )})`,
    // @ts-expect-error - Should we get 4 different cases to get the typing to work nicely?
    type: bitType,
    dataCount: bitVectorSize,
    writeData: ( write: ( tIndex: WGSLExpressionU32, tValue: WGSLExpressionT ) => WGSLStatements ) => {
      return bitType.writeU32s( write, varName );
    },
    // TODO: allow overriding data output?? (an extra filter on top?) --- or also one that just provides the U32s raw.
//    deserialize: arr => [ ...arr ].map( value => {
//      const countBitQuantity = Math.ceil( Math.log2( workgroupSize * grainSize ) );
//      const countsPerComponent = Math.floor( 32 / countBitQuantity );
//
//      return [
//        // raw
//        ByteEncoder.toU32Hex( value ),
//        ...( _.range( 0, countsPerComponent ).map( i => {
//          const start = i * countBitQuantity;
//          const end = ( i + 1 ) * countBitQuantity;
//          return ( value >> start ) & ( ( 1 << countBitQuantity ) - 1 );
//        } ) )
//      ];
//    } ),
    lineToLog: ConsoleLoggedLine.toLogExisting
  } );

  return `
    ${commentWGSL( 'begin n_bit_compact_single_sort' )}

    ${logStringWGSL( blueprint, `n_bit_compact_single_sort workgroupSize:${workgroupSize}, grainSize:${grainSize}, bitsPerInnerPass:${bitsPerInnerPass}, bitVectorSize:${bitVectorSize}, length:"${lengthExpression ? lengthExpression( blueprint ) : null}" earlyLoad:${earlyLoad}` )}

    {
      var tb_bits_vector = ${{
        1: '0u',
        2: 'vec2( 0u )',
        3: 'vec3( 0u )',
        4: 'vec4( 0u )'
      }[ bitVectorSize ]};

      ${earlyLoad ? `
        var tb_values: array<${order.type.valueType( blueprint )}, ${grainSize}>;
      ` : ''}

      // Store our thread's "raked" values histogram into tb_bits_vector
      ${unrollWGSL( 0, grainSize, i => `
        // TODO: see if factoring out constants doesn't kill registers
        if ( ${u32( grainSize )} * ${localIndex} + ${u32( i )} < ${lengthExpression( blueprint )} ) {
          let tb_value = ${valueScratch}[ ${u32( grainSize )} * ${localIndex} + ${u32( i )} ];
          let tb_bits = ${getBits( 'tb_value' )};

          ${logValueWGSL( blueprint, {
            value: 'tb_value',
            name: `tb_value (raked index ${i})`,
            type: order.type
          } )}

          ${logValueWGSL( blueprint, {
            value: 'tb_bits',
            name: `tb_bits (raked index ${i})`,
            type: U32Type
          } )}

          ${bitPackRadixIncrementWGSL( {
            bitVector: 'tb_bits_vector',
            bits: 'tb_bits',
            bitsPerInnerPass: bitsPerInnerPass,
            bitVectorSize: bitVectorSize,
            maxCount: workgroupSize * grainSize
          } )}

          ${earlyLoad ? `
            tb_values[ ${u32( i )} ] = tb_value;
          ` : ''}
        }
      ` )}

      ${logPackedBits( 'n_bit histogram initial', 'tb_bits_vector' )}

      ${scanWGSL( blueprint, {
        value: 'tb_bits_vector',
        // @ts-expect-error - Hmm, should we actually split this into 4 cases?
        binaryOp: addBinaryOp,
        scratch: bitsScratch,
        workgroupSize: workgroupSize,
        exclusive: true,
        needsValidScratch: true
      } )}

      ${logPackedBits( 'n_bit histogram scanned', 'tb_bits_vector' )}

      // now tb_bits_vector holds the partial exclusive scan, but the inclusive scan is still in the array
      var tb_offsets = ${bitsScratch}[ ${u32( workgroupSize - 1 )} ];

      ${bitPackRadixExclusiveScanWGSL( {
        bitVector: 'tb_offsets',
        bitsPerInnerPass: bitsPerInnerPass,
        bitVectorSize: bitVectorSize,
        maxCount: workgroupSize * grainSize
      } )}

      ${!earlyLoad ? `
        var tb_values: array<${order.type.valueType( blueprint )}, ${grainSize}>;

        ${unrollWGSL( 0, grainSize, i => `
          // TODO: see if factoring out constants doesn't kill registers
          tb_values[ ${u32( i )} ] = ${valueScratch}[ ${u32( grainSize )} * ${localIndex} + ${u32( i )} ];
        ` )}

        workgroupBarrier();
      ` : ''}

      ${unrollWGSL( 0, grainSize, i => `
        // TODO: see if factoring out constants doesn't kill registers
        if ( ${u32( grainSize )} * ${localIndex} + ${u32( i )} < ${lengthExpression( blueprint )} ) {
          let tb_value = tb_values[ ${u32( i )} ];
          let tb_bits = ${getBits( 'tb_value' )};

          // TODO: a way to compute the index and access both of these efficiently?
          ${valueScratch}[ ( ${bitPackRadixAccessWGSL( {
            bitVector: 'tb_offsets',
            bits: 'tb_bits',
            bitsPerInnerPass: bitsPerInnerPass,
            bitVectorSize: bitVectorSize,
            maxCount: workgroupSize * grainSize
          } )} ) + ( ${bitPackRadixAccessWGSL( {
            bitVector: 'tb_bits_vector',
            bits: 'tb_bits',
            bitsPerInnerPass: bitsPerInnerPass,
            bitVectorSize: bitVectorSize,
            maxCount: workgroupSize * grainSize
          } )} ) ] = tb_value;

          // NOTE the increment, so that we'll write to the next location next time
          ${bitPackRadixIncrementWGSL( {
            bitVector: 'tb_bits_vector',
            bits: 'tb_bits',
            bitsPerInnerPass: bitsPerInnerPass,
            bitVectorSize: bitVectorSize,
            maxCount: workgroupSize * grainSize
          } )}
        }
      ` )}

      workgroupBarrier();
    }

    ${commentWGSL( 'end n_bit_compact_single_sort' )}
  `;
};

export default nBitCompactSingleSortWGSL;

alpenglow.register( 'nBitCompactSingleSortWGSL', nBitCompactSingleSortWGSL );
