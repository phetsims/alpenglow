// Copyright 2024-2026, University of Colorado Boulder

/**
 * ConcreteType for a TwoPassFineRenderableFace
 *
 * TODO auto create?
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { ConcreteType, StoreStatementCallback } from '../../compute/ConcreteType.js';
import { TwoPassFineRenderableFace } from './TwoPassFineRenderableFace.js';
import { wgsl, WGSLExpression, WGSLStatements } from '../WGSLString.js';
import { ByteEncoder } from '../../compute/ByteEncoder.js';
import { TwoPassFineRenderableFaceWGSL } from './TwoPassFineRenderableFaceWGSL.js';

const dwords = 5;

export const TwoPassFineRenderableFaceType: ConcreteType<TwoPassFineRenderableFace> = {
  name: 'TwoPassFineRenderableFace',
  bytesPerElement: dwords * 4,

  // TODO: do we need to implement these?
  equals: () => false,
  equalsWGSL: () => wgsl`false`,

  encode( value: TwoPassFineRenderableFace, encoder: ByteEncoder ): void {
    encoder.pushU32(
      value.renderProgramIndex |
      ( value.needsCentroid ? 0x10000000 : 0 ) |
      ( value.needsFace ? 0x20000000 : 0 ) |
      ( value.isConstant ? 0x40000000 : 0 ) |
      ( value.isFullArea ? 0x80000000 : 0 )
    );
    encoder.pushU32( value.edgesIndex );
    encoder.pushU32( value.numEdges );

    // Support signed values packing into a u32
    encoder.pushU32(
      (
        ( value.minXCount & 0xff ) |
        ( ( value.minYCount & 0xff ) << 8 ) |
        ( ( value.maxXCount & 0xff ) << 16 ) |
        ( ( value.maxYCount & 0xff ) << 24 )
      ) >>> 0 // because JS omg
    );

    encoder.pushU32( value.nextAddress );
  },
  decode( encoder: ByteEncoder, offset: number ): TwoPassFineRenderableFace {
    const bits = encoder.fullU32Array[ offset + 0 ];
    const counts = encoder.fullU32Array[ offset + 3 ];

    const i8BitsToNumber = ( bits: number ): number => {
      return ( bits & 0x80 ) ? ( bits - 0x100 ) : bits;
    };

    // TODO: factor out constants
    return {
      renderProgramIndex: bits & 0x00ffffff,
      needsCentroid: !!( bits & 0x10000000 ),
      needsFace: !!( bits & 0x20000000 ),
      isConstant: !!( bits & 0x40000000 ),
      isFullArea: !!( bits & 0x80000000 ),
      edgesIndex: encoder.fullU32Array[ offset + 1 ],
      numEdges: encoder.fullU32Array[ offset + 2 ],
      minXCount: i8BitsToNumber( counts & 0xff ),
      minYCount: i8BitsToNumber( ( counts >> 8 ) & 0xff ),
      maxXCount: i8BitsToNumber( ( counts >> 16 ) & 0xff ),
      maxYCount: i8BitsToNumber( ( counts >> 24 ) & 0xff ),
      nextAddress: encoder.fullU32Array[ offset + 4 ]
    };
  },
  valueType: TwoPassFineRenderableFaceWGSL,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`${value}.bits` )}
       ${storeStatement( wgsl`1u`, wgsl`${value}.edges_index` )}
       ${storeStatement( wgsl`2u`, wgsl`${value}.num_edges` )}
       ${storeStatement( wgsl`3u`, wgsl`${value}.clip_counts` )}
       ${storeStatement( wgsl`4u`, wgsl`${value}.next_address` )}
    `;
  },
  wgslAlign: 4 * Math.ceil( dwords / 4 ) * 4, // possibly wrong?
  wgslSize: 4 * dwords,

  generateRandom: ( fullSize = false ) => {
    throw new Error( 'unimplemented' );
  },

  toDebugString: ( value: TwoPassFineRenderableFace ) => 'TwoPassFineRenderableFace'
};