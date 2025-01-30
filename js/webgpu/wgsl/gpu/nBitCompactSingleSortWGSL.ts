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

import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import { BitOrder, U32Add, U32Type, Vec2uAdd, Vec2uType, Vec3uAdd, Vec3uType, Vec4uAdd, Vec4uType } from '../../compute/ConcreteType.js';
import { decimalS, u32S, wgsl, WGSLExpressionT, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../WGSLString.js';
import { LOCAL_INDEXABLE_DEFAULTS, LocalIndexable, RakedSizable } from '../WGSLUtils.js';
import { logWGSL } from './logWGSL.js';
import { ConsoleLoggedLine } from '../../compute/ConsoleLogger.js';
import { commentWGSL } from './commentWGSL.js';
import { logStringWGSL } from './logStringWGSL.js';
import { unrollWGSL } from './unrollWGSL.js';
import { logValueWGSL } from './logValueWGSL.js';
import { bitPackRadixIncrementWGSL } from './bitPackRadixIncrementWGSL.js';
import { scanWGSL } from './scanWGSL.js';
import { bitPackRadixExclusiveScanWGSL } from './bitPackRadixExclusiveScanWGSL.js';
import { bitPackRadixAccessWGSL } from './bitPackRadixAccessWGSL.js';

export type nBitCompactSingleSortWGSLOptions<T> = {
  // Currently mostly used for the type, but we might be able to use it for more later. (TODO)
  order: BitOrder<T>;

  // var<workgroup> array<u32|vec2u|vec3u|vec4u, workgroupSize> TODO: we can pack this more efficiently, no?
  bitsScratch: WGSLVariableName;

  // var<workgroup> array<T, workgroupSize * grainSize>
  valueScratch: WGSLVariableName;

  lengthExpression: WGSLExpressionU32; // TODO: support null (optional)?

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
  ...LOCAL_INDEXABLE_DEFAULTS // eslint-disable-line phet/no-object-spread-on-non-literals
} as const;

export const nBitCompactSingleSortWGSL = <T>(
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

  const logPackedBits = <T>( name: string, varName: WGSLVariableName ) => logWGSL<T>( {
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

  return wgsl`
    ${commentWGSL( 'begin n_bit_compact_single_sort' )}

    ${logStringWGSL( `n_bit_compact_single_sort workgroupSize:${workgroupSize}, grainSize:${grainSize}, bitsPerInnerPass:${bitsPerInnerPass}, bitVectorSize:${bitVectorSize}, length:"${lengthExpression ? lengthExpression : null}" earlyLoad:${earlyLoad}` )}

    {
      var tb_bits_vector = ${{
        1: wgsl`0u`,
        2: wgsl`vec2( 0u )`,
        3: wgsl`vec3( 0u )`,
        4: wgsl`vec4( 0u )`
      }[ bitVectorSize ]};

      ${earlyLoad ? wgsl`
        var tb_values: array<${order.type.valueType}, ${decimalS( grainSize )}>;
      ` : wgsl``}

      // Store our thread's "raked" values histogram into tb_bits_vector
      ${unrollWGSL( 0, grainSize, i => wgsl`
        // TODO: see if factoring out constants doesn't kill registers
        if ( ${u32S( grainSize )} * ${localIndex} + ${u32S( i )} < ${lengthExpression} ) {
          let tb_value = ${valueScratch}[ ${u32S( grainSize )} * ${localIndex} + ${u32S( i )} ];
          let tb_bits = ${getBits( wgsl`tb_value` )};

          ${logValueWGSL( {
            value: 'tb_value',
            name: `tb_value (raked index ${i})`,
            type: order.type
          } )}

          ${logValueWGSL( {
            value: 'tb_bits',
            name: `tb_bits (raked index ${i})`,
            type: U32Type
          } )}

          ${bitPackRadixIncrementWGSL( {
            bitVector: wgsl`tb_bits_vector`,
            bits: wgsl`tb_bits`,
            bitsPerInnerPass: bitsPerInnerPass,
            bitVectorSize: bitVectorSize,
            maxCount: workgroupSize * grainSize
          } )}

          ${earlyLoad ? wgsl`
            tb_values[ ${u32S( i )} ] = tb_value;
          ` : wgsl``}
        }
      ` )}

      ${logPackedBits( 'n_bit histogram initial', wgsl`tb_bits_vector` )}

      ${scanWGSL( {
        value: wgsl`tb_bits_vector`,
        // @ts-expect-error - Hmm, should we actually split this into 4 cases?
        binaryOp: addBinaryOp,
        scratch: bitsScratch,
        workgroupSize: workgroupSize,
        exclusive: true,
        needsValidScratch: true
      } )}

      ${logPackedBits( 'n_bit histogram scanned', wgsl`tb_bits_vector` )}

      // now tb_bits_vector holds the partial exclusive scan, but the inclusive scan is still in the array
      var tb_offsets = ${bitsScratch}[ ${u32S( workgroupSize - 1 )} ];

      ${bitPackRadixExclusiveScanWGSL( {
        bitVector: wgsl`tb_offsets`,
        bitsPerInnerPass: bitsPerInnerPass,
        bitVectorSize: bitVectorSize,
        maxCount: workgroupSize * grainSize
      } )}

      ${!earlyLoad ? wgsl`
        var tb_values: array<${order.type.valueType}, ${decimalS( grainSize )}>;

        ${unrollWGSL( 0, grainSize, i => wgsl`
          // TODO: see if factoring out constants doesn't kill registers
          tb_values[ ${u32S( i )} ] = ${valueScratch}[ ${u32S( grainSize )} * ${localIndex} + ${u32S( i )} ];
        ` )}

        workgroupBarrier();
      ` : wgsl``}

      ${unrollWGSL( 0, grainSize, i => wgsl`
        // TODO: see if factoring out constants doesn't kill registers
        if ( ${u32S( grainSize )} * ${localIndex} + ${u32S( i )} < ${lengthExpression} ) {
          let tb_value = tb_values[ ${u32S( i )} ];
          let tb_bits = ${getBits( wgsl`tb_value` )};

          // TODO: a way to compute the index and access both of these efficiently?
          ${valueScratch}[ ( ${bitPackRadixAccessWGSL( {
            bitVector: wgsl`tb_offsets`,
            bits: wgsl`tb_bits`,
            bitsPerInnerPass: bitsPerInnerPass,
            bitVectorSize: bitVectorSize,
            maxCount: workgroupSize * grainSize
          } )} ) + ( ${bitPackRadixAccessWGSL( {
            bitVector: wgsl`tb_bits_vector`,
            bits: wgsl`tb_bits`,
            bitsPerInnerPass: bitsPerInnerPass,
            bitVectorSize: bitVectorSize,
            maxCount: workgroupSize * grainSize
          } )} ) ] = tb_value;

          // NOTE the increment, so that we'll write to the next location next time
          ${bitPackRadixIncrementWGSL( {
            bitVector: wgsl`tb_bits_vector`,
            bits: wgsl`tb_bits`,
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

alpenglow.register( 'nBitCompactSingleSortWGSL', nBitCompactSingleSortWGSL );