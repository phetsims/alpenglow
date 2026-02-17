// Copyright 2024-2025, University of Colorado Boulder

/**
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector2 from '../../../../../dot/js/Vector2.js';
import Vector3 from '../../../../../dot/js/Vector3.js';
import { exampleTestEdges } from './exampleTestEdges.js';
import { asyncTestWithDevice } from '../ShaderTestUtils.js';
import { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { F32Type, getArrayType } from '../../compute/ConcreteType.js';
import { DirectModule } from '../../compute/DirectModule.js';
import { wgsl, WGSLMainModule, WGSLSlot } from '../../wgsl/WGSLString.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';
import { matthes_drakopoulos_clipWGSL } from '../../wgsl/clip/matthes_drakopoulos_clipWGSL.js';
import { Procedure } from '../../compute/Procedure.js';
import { Routine } from '../../compute/Routine.js';
import { LineClipping } from '../../../clip/LineClipping.js';

QUnit.module( 'MatthesDrakopoulosClipTests' );

const matthesDrakopoulosTest = ( name: string, extractSlope: boolean ) => {
  asyncTestWithDevice( name, async ( device, deviceContext ) => {
    const inputEdges = exampleTestEdges;

    const dispatchSize = inputEdges.length;

    const inputSlot = new BufferArraySlot( getArrayType( F32Type, dispatchSize * 4 ) );
    const outputSlot = new BufferArraySlot( getArrayType( F32Type, dispatchSize * 5 ) );

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
          let out = i * 5u;
          let p0 = vec2( input[ in + 0u ], input[ in + 1u ] );
          let p1 = vec2( input[ in + 2u ], input[ in + 3u ] );
          let result = ${matthes_drakopoulos_clipWGSL(
            wgsl`p0`,
            wgsl`p1`,
            wgsl`0f`,
            wgsl`0f`,
            wgsl`10f`,
            wgsl`10f`
          )};
          let p0out = result.p0;
          let p1out = result.p1;
          let clipped = result.clipped;
          output[ out + 0u ] = p0out.x;
          output[ out + 1u ] = p0out.y;
          output[ out + 2u ] = p1out.x;
          output[ out + 3u ] = p1out.y;
          output[ out + 4u ] = select( 0f, 1f, clipped );
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
      const baseIndex = i * 5;

      const p0 = inputEdges[ i ][ 0 ];
      const p1 = inputEdges[ i ][ 1 ];

      const expectedP0 = p0.copy();
      const expectedP1 = p1.copy();
      const expectedClipped = LineClipping.matthesDrakopoulosClip( expectedP0, expectedP1, 0, 0, 10, 10 );

      const actualP0 = new Vector2( outputArray[ baseIndex ], outputArray[ baseIndex + 1 ] );
      const actualP1 = new Vector2( outputArray[ baseIndex + 2 ], outputArray[ baseIndex + 3 ] );
      const actualClipped = outputArray[ baseIndex + 4 ] !== 0;

      if ( actualClipped !== expectedClipped ) {
        return `matthes_drakopoulos_clip clip discrepancy, expected: ${expectedClipped}, actual: ${actualClipped}, i:${i}`;
      }
      if ( actualClipped ) {
        if ( !expectedP0.equalsEpsilon( actualP0, 1e-5 ) ) {
          return `matthes_drakopoulos_clip p0 discrepancy, expected: ${expectedP0}, actual: ${actualP0}, i:${i}`;
        }
        if ( !expectedP1.equalsEpsilon( actualP1, 1e-5 ) ) {
          return `matthes_drakopoulos_clip p1 discrepancy, expected: ${expectedP1}, actual: ${actualP1}, i:${i}`;
        }
      }
    }

    return null;
  } );
};

matthesDrakopoulosTest( 'matthes_drakopoulos_clip unextracted', false );
matthesDrakopoulosTest( 'matthes_drakopoulos_clip extracted', true );