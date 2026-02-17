// Copyright 2024-2025, University of Colorado Boulder

/**
 * ConcreteType for a TwoPassInitialRenderableFace
 *
 * TODO auto create?
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { ConcreteType, StoreStatementCallback } from '../../compute/ConcreteType.js';
import { TwoPassInitialRenderableFace } from './TwoPassInitialRenderableFace.js';
import { wgsl, WGSLExpression, WGSLStatements } from '../WGSLString.js';
import { ByteEncoder } from '../../compute/ByteEncoder.js';
import { TwoPassInitialRenderableFaceWGSL } from './TwoPassInitialRenderableFaceWGSL.js';

const dwords = 3;

export const TwoPassInitialRenderableFaceType: ConcreteType<TwoPassInitialRenderableFace> = {
  name: 'TwoPassInitialRenderableFace',
  bytesPerElement: dwords * 4,

  // TODO: do we need to implement these?
  equals: () => false,
  equalsWGSL: () => wgsl`false`,

  encode( value: TwoPassInitialRenderableFace, encoder: ByteEncoder ): void {
    encoder.pushU32(
      value.renderProgramIndex |
      ( value.needsCentroid ? 0x10000000 : 0 ) |
      ( value.needsFace ? 0x20000000 : 0 ) |
      ( value.isConstant ? 0x40000000 : 0 ) |
      ( value.isFullArea ? 0x80000000 : 0 )
    );
    encoder.pushU32( value.edgesIndex );
    encoder.pushU32( value.numEdges );
  },
  decode( encoder: ByteEncoder, offset: number ): TwoPassInitialRenderableFace {
    const bits = encoder.fullU32Array[ offset + 0 ];

    // TODO: factor out constants
    return {
      renderProgramIndex: bits & 0x00ffffff,
      needsCentroid: !!( bits & 0x10000000 ),
      needsFace: !!( bits & 0x20000000 ),
      isConstant: !!( bits & 0x40000000 ),
      isFullArea: !!( bits & 0x80000000 ),
      edgesIndex: encoder.fullU32Array[ offset + 1 ],
      numEdges: encoder.fullU32Array[ offset + 2 ]
    };
  },
  valueType: TwoPassInitialRenderableFaceWGSL,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`${value}.bits` )}
       ${storeStatement( wgsl`1u`, wgsl`${value}.edges_index` )}
       ${storeStatement( wgsl`2u`, wgsl`${value}.num_edges` )}
    `;
  },
  wgslAlign: 4 * Math.ceil( dwords / 4 ) * 4, // possibly wrong?
  wgslSize: 4 * dwords,

  generateRandom: ( fullSize = false ) => {
    throw new Error( 'unimplemented' );
  },

  toDebugString: ( value: TwoPassInitialRenderableFace ) => 'TwoPassInitialRenderableFace'
};