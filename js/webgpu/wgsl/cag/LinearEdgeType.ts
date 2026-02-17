// Copyright 2024-2025, University of Colorado Boulder

/**
 * ConcreteType for a LinearEdge
 *
 * TODO auto create?
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector2 from '../../../../../dot/js/Vector2.js';
import type { ConcreteType, StoreStatementCallback } from '../../compute/ConcreteType.js';
import { LinearEdge } from '../../../cag/LinearEdge.js';
import { wgsl, WGSLExpression, WGSLExpressionBool, WGSLExpressionT, WGSLStatements, WGSLStringModule } from '../WGSLString.js';
import { LinearEdgeWGSL } from './LinearEdgeWGSL.js';
import type { ByteEncoder } from '../../compute/ByteEncoder.js';

const dwords = 4;

export const LinearEdgeType: ConcreteType<LinearEdge> = {
  name: 'LinearEdge',
  bytesPerElement: dwords * 4,

  equals: ( a: LinearEdge, b: LinearEdge ) => a.startPoint.equals( b.startPoint ) && a.endPoint.equals( b.endPoint ),
  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => new WGSLStringModule( 'equals_linear_edge', wgsl`equals_linear_edge( ${a}, ${b} )`, wgsl`
    fn equals_linear_edge( a: ${LinearEdgeWGSL}, b: ${LinearEdgeWGSL} ) -> bool {
      return all( a.startPoint == b.startPoint ) && all( a.endPoint == b.endPoint );
    }
` ),

  encode( value: LinearEdge, encoder: ByteEncoder ): void {
    encoder.pushF32( value.startPoint.x );
    encoder.pushF32( value.startPoint.y );
    encoder.pushF32( value.endPoint.x );
    encoder.pushF32( value.endPoint.y );
  },
  decode( encoder: ByteEncoder, offset: number ): LinearEdge {
    return new LinearEdge(
      new Vector2( encoder.fullF32Array[ offset + 0 ], encoder.fullF32Array[ offset + 1 ] ),
      new Vector2( encoder.fullF32Array[ offset + 2 ], encoder.fullF32Array[ offset + 3 ] )
    );
  },
  valueType: LinearEdgeWGSL,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`bitcast<u32>( ${value}.startPoint.x )` )}
       ${storeStatement( wgsl`1u`, wgsl`bitcast<u32>( ${value}.startPoint.y )` )}
       ${storeStatement( wgsl`2u`, wgsl`bitcast<u32>( ${value}.endPoint.x )` )}
       ${storeStatement( wgsl`3u`, wgsl`bitcast<u32>( ${value}.endPoint.y )` )}
    `;
  },
  wgslAlign: 4 * Math.ceil( dwords / 4 ) * 4, // possibly wrong?
  wgslSize: 4 * dwords,

  generateRandom: ( fullSize = false ) => {
    throw new Error( 'unimplemented' );
  },

  toDebugString: ( value: LinearEdge ) => 'LinearEdge'
};