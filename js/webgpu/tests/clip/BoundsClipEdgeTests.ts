// Copyright 2023-2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { asyncTestWithDevice, bounds_clip_edgeWGSL, BoundsClipping, BufferArraySlot, BufferBindingType, DirectModule, F32Type, getArrayType, LinearEdge, LinearEdgeWGSL, Procedure, Routine, wgsl, WGSLMainModule, WGSLSlot } from '../../../imports.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Vector3 from '../../../../../dot/js/Vector3.js';
import exampleTestEdges from './exampleTestEdges.js'; // NOTE: DO NOT put in imports, we don't want extra data there

QUnit.module( 'BoundsClipEdgeTests' );

asyncTestWithDevice( 'bounds_clip_edge', async ( device, deviceContext ) => {
  const inputEdges = exampleTestEdges;

  const dispatchSize = inputEdges.length;

  const inputSlot = new BufferArraySlot( getArrayType( F32Type, dispatchSize * 4 ) );
  const outputSlot = new BufferArraySlot( getArrayType( F32Type, dispatchSize * 13 ) );

  const module = new DirectModule<number>( {
    name: `module_${name}`,
    main: new WGSLMainModule( [
      new WGSLSlot( 'input', inputSlot, BufferBindingType.READ_ONLY_STORAGE ),
      new WGSLSlot( 'output', outputSlot, BufferBindingType.STORAGE )
    ], wgsl`
      @compute @workgroup_size(1) fn main(
        @builtin(global_invocation_id) id: vec3<u32>
      ) {
        let i = id.x;
        
        let in = i * 4u;
        let out = i * 13u;
        let p0 = vec2( input[ in + 0u ], input[ in + 1u ] );
        let p1 = vec2( input[ in + 2u ], input[ in + 3u ] );
        let result = ${bounds_clip_edgeWGSL(
          wgsl`${LinearEdgeWGSL}( p0, p1 )`,
          wgsl`0f`,
          wgsl`0f`,
          wgsl`10f`,
          wgsl`10f`,
          wgsl`5f`,
          wgsl`5f`
        )};
        
        let e0p0 = result.edges[ 0u ].startPoint;
        let e0p1 = result.edges[ 0u ].endPoint;
        
        let e1p0 = result.edges[ 1u ].startPoint;
        let e1p1 = result.edges[ 1u ].endPoint;
        
        let e2p0 = result.edges[ 2u ].startPoint;
        let e2p1 = result.edges[ 2u ].endPoint;
        
        let count = f32( result.count );
        
        output[ out + 0u ] = e0p0.x;
        output[ out + 1u ] = e0p0.y;
        output[ out + 2u ] = e0p1.x;
        output[ out + 3u ] = e0p1.y;
        output[ out + 4u ] = e1p0.x;
        output[ out + 5u ] = e1p0.y;
        output[ out + 6u ] = e1p1.x;
        output[ out + 7u ] = e1p1.y;
        output[ out + 8u ] = e2p0.x;
        output[ out + 9u ] = e2p0.y;
        output[ out + 10u ] = e2p1.x;
        output[ out + 11u ] = e2p1.y;
        output[ out + 12u ] = count;
      }
    ` ),
    setDispatchSize: ( dispatchSize: Vector3, size: number ) => {
      dispatchSize.x = size;
    }
  } );

  const routine = await Routine.create(
    deviceContext,
    module,
    [ inputSlot, outputSlot ],
    Routine.INDIVIDUAL_LAYOUT_STRATEGY,
    ( context, execute, input: number[] ) => {
      context.setTypedBufferValue( inputSlot, input );

      execute( context, dispatchSize );

      return context.getTypedBufferValue( outputSlot );
    }
  );

  const procedure = new Procedure( routine ).bindRemainingBuffers();

  const outputArray = await procedure.standaloneExecute( deviceContext, inputEdges.flatMap( entry => [
    entry[ 0 ].x,
    entry[ 0 ].y,
    entry[ 1 ].x,
    entry[ 1 ].y
  ] ) );

  procedure.dispose();

  for ( let i = 0; i < dispatchSize; i++ ) {
    const baseIndex = i * 13;

    const inputEdge = new LinearEdge(
      inputEdges[ i ][ 0 ],
      inputEdges[ i ][ 1 ]
    );

    const actualEdges: LinearEdge[] = [];
    const actualCount = outputArray[ baseIndex + 12 ];
    for ( let j = 0; j < actualCount; j++ ) {
      const edgeBaseIndex = baseIndex + j * 4;
      const edge = new LinearEdge(
        new Vector2( outputArray[ edgeBaseIndex ], outputArray[ edgeBaseIndex + 1 ] ),
        new Vector2( outputArray[ edgeBaseIndex + 2 ], outputArray[ edgeBaseIndex + 3 ] )
      );
      if ( edge.startPoint.distance( edge.endPoint ) > 1e-6 ) {
        actualEdges.push( edge );
      }
    }

    const expectedEdges: LinearEdge[] = [];
    BoundsClipping.boundsClipEdge( inputEdge.startPoint, inputEdge.endPoint, 0, 0, 10, 10, 5, 5, expectedEdges );

    if ( actualEdges.length !== expectedEdges.length ) {
      return `bounds_clip_edge edge count discrepancy, expected: ${expectedEdges.length}, actual: ${actualEdges.length}, i:${i}`;
    }

    for ( let i = 0; i < actualEdges.length; i++ ) {
      const actualEdge = actualEdges[ i ];
      const expectedEdge = expectedEdges[ i ];

      if ( !expectedEdge.startPoint.equalsEpsilon( actualEdge.startPoint, 1e-5 ) ) {
        return `bounds_clip_edge start point discrepancy, expected: ${expectedEdge.startPoint}, actual: ${actualEdge.startPoint}, i:${i}`;
      }
      if ( !expectedEdge.endPoint.equalsEpsilon( actualEdge.endPoint, 1e-5 ) ) {
        return `bounds_clip_edge end point discrepancy, expected: ${expectedEdge.endPoint}, actual: ${actualEdge.endPoint}, i:${i}`;
      }
    }
  }

  return null;
} );