// Copyright 2024-2025, University of Colorado Boulder

/**
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Bounds2 from '../../../../../dot/js/Bounds2.js';
import Matrix3 from '../../../../../dot/js/Matrix3.js';
import Matrix4 from '../../../../../dot/js/Matrix4.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Vector3 from '../../../../../dot/js/Vector3.js';
import Vector4 from '../../../../../dot/js/Vector4.js';
import { DeviceContext } from '../../compute/DeviceContext.js';
import { RenderProgram } from '../../../render-program/RenderProgram.js';
import { LinearEdge } from '../../../cag/LinearEdge.js';
import { ConcreteType, F32Type, getArrayType, StoreStatementCallback, U32Type } from '../../compute/ConcreteType.js';
import { wgsl, WGSLExpression, WGSLMainModule, WGSLReferenceModule, WGSLSlot, WGSLStatements } from '../../wgsl/WGSLString.js';
import { ByteEncoder } from '../../compute/ByteEncoder.js';
import { BufferSlot } from '../../compute/BufferSlot.js';
import { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { DirectModule } from '../../compute/DirectModule.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';
import { evaluate_render_program_instructionsWGSL } from '../../wgsl/render-program/evaluate_render_program_instructionsWGSL.js';
import { LinearEdgeWGSL } from '../../wgsl/cag/LinearEdgeWGSL.js';
import { Routine } from '../../compute/Routine.js';
import { RenderInstruction } from '../../../render-program/RenderInstruction.js';
import { Procedure } from '../../compute/Procedure.js';
import { asyncTestWithDevice } from '../ShaderTestUtils.js';
import { RenderEvaluationContext } from '../../../render-program/RenderEvaluationContext.js';
import { RenderColor } from '../../../render-program/RenderColor.js';
import { RenderPremultiply } from '../../../render-program/RenderPremultiply.js';
import { RenderUnpremultiply } from '../../../render-program/RenderUnpremultiply.js';
import { RenderSRGBToLinearSRGB } from '../../../render-program/RenderSRGBToLinearSRGB.js';
import { RenderLinearSRGBToSRGB } from '../../../render-program/RenderLinearSRGBToSRGB.js';
import { RenderLinearDisplayP3ToLinearSRGB } from '../../../render-program/RenderLinearDisplayP3ToLinearSRGB.js';
import { RenderLinearSRGBToLinearDisplayP3 } from '../../../render-program/RenderLinearSRGBToLinearDisplayP3.js';
import { RenderOklabToLinearSRGB } from '../../../render-program/RenderOklabToLinearSRGB.js';
import { RenderLinearSRGBToOklab } from '../../../render-program/RenderLinearSRGBToOklab.js';
import { RenderNormalize } from '../../../render-program/RenderNormalize.js';
import { RenderAlpha } from '../../../render-program/RenderAlpha.js';
import { RenderNormalDebug } from '../../../render-program/RenderNormalDebug.js';
import { RenderStack } from '../../../render-program/RenderStack.js';
import { RenderLinearBlend } from '../../../render-program/RenderLinearBlend.js';
import { RenderRadialBlend } from '../../../render-program/RenderRadialBlend.js';
import { RenderLinearGradient } from '../../../render-program/RenderLinearGradient.js';
import { RenderGradientStop } from '../../../render-program/RenderGradientStop.js';
import { RenderExtend } from '../../../render-program/RenderExtend.js';
import { RenderRadialGradient } from '../../../render-program/RenderRadialGradient.js';
import { RenderBarycentricBlend, RenderBarycentricBlendAccuracy } from '../../../render-program/RenderBarycentricBlend.js';
import { RenderBarycentricPerspectiveBlend, RenderBarycentricPerspectiveBlendAccuracy } from '../../../render-program/RenderBarycentricPerspectiveBlend.js';
import { RenderBlendCompose } from '../../../render-program/RenderBlendCompose.js';
import { RenderComposeType } from '../../../render-program/RenderComposeType.js';
import { RenderBlendType } from '../../../render-program/RenderBlendType.js';
import { RenderPhong } from '../../../render-program/RenderPhong.js';
import { RenderLight } from '../../../render-program/RenderLight.js';
import { RenderFilter } from '../../../render-program/RenderFilter.js';
import { RenderLinearBlendAccuracy } from '../../../render-program/RenderLinearBlendAccuracy.js';
import { RenderRadialBlendAccuracy } from '../../../render-program/RenderRadialBlendAccuracy.js';
import { RenderRadialGradientAccuracy } from '../../../render-program/RenderRadialGradientAccuracy.js';
import { RenderLinearGradientAccuracy } from '../../../render-program/RenderLinearGradientAccuracy.js';

QUnit.module( 'RenderProgramComputeTests' );

const renderProgramComputeEvaluate = async (
  name: string,
  deviceContext: DeviceContext,
  renderProgram: RenderProgram,
  edgesOffset: number,
  numEdges: number,
  edges: LinearEdge[],
  isFullArea: boolean,
  needsFace: boolean,
  area: number,
  bounds: Bounds2,
  minXCount: number,
  minYCount: number,
  maxXCount: number,
  maxYCount: number
): Promise<Vector4> => {
  const MAX_RENDER_INSTRUCTIONS = 2 ** 15;

  class Config {
    public constructor(
      public renderProgramIndex: number,
      public edgesOffset: number,
      public numEdges: number,
      public isFullArea: boolean,
      public needsFace: boolean,
      public area: number,
      public minX: number,
      public minY: number,
      public maxX: number,
      public maxY: number,
      public minXCount: number,
      public minYCount: number,
      public maxXCount: number,
      public maxYCount: number
    ) {}
  }

  const configType: ConcreteType<Config> = {
    name: 'Config',
    bytesPerElement: 14 * 4,
    equals: () => false,
    equalsWGSL: () => wgsl`false`,
    encode( value: Config, encoder: ByteEncoder ): void {
      encoder.pushU32( value.renderProgramIndex );
      encoder.pushU32( value.edgesOffset );
      encoder.pushU32( value.numEdges );
      encoder.pushU32( value.isFullArea ? 1 : 0 );
      encoder.pushU32( value.needsFace ? 1 : 0 );
      encoder.pushF32( value.area );
      encoder.pushF32( value.minX );
      encoder.pushF32( value.minY );
      encoder.pushF32( value.maxX );
      encoder.pushF32( value.maxY );
      encoder.pushI32( value.minXCount );
      encoder.pushI32( value.minYCount );
      encoder.pushI32( value.maxXCount );
      encoder.pushI32( value.maxYCount );
    },
    decode( encoder: ByteEncoder, offset: number ): Config {
      return new Config(
        encoder.fullU32Array[ offset + 0 ],
        encoder.fullU32Array[ offset + 1 ],
        encoder.fullU32Array[ offset + 2 ],
        encoder.fullU32Array[ offset + 3 ] !== 0,
        encoder.fullU32Array[ offset + 4 ] !== 0,
        encoder.fullF32Array[ offset + 5 ],
        encoder.fullF32Array[ offset + 6 ],
        encoder.fullF32Array[ offset + 7 ],
        encoder.fullF32Array[ offset + 8 ],
        encoder.fullF32Array[ offset + 9 ],
        encoder.fullI32Array[ offset + 10 ],
        encoder.fullI32Array[ offset + 11 ],
        encoder.fullI32Array[ offset + 12 ],
        encoder.fullI32Array[ offset + 13 ]
      );
    },
    valueType: new WGSLReferenceModule( 'Config', wgsl`
      struct Config {
        render_program_index: u32,
        edgesOffset: u32,
        numEdges: u32,
        isFullArea: u32, // 1 or 0
        needsFace: u32, // 1 or 0
        area: f32,
        minX: f32,
        minY: f32,
        maxX: f32,
        maxY: f32,
        minXCount: i32,
        minYCount: i32,
        maxXCount: i32,
        maxYCount: i32
      }
    ` ),
    writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
      return wgsl`
         ${storeStatement( wgsl`0u`, wgsl`${value}.render_program_index` )}
         ${storeStatement( wgsl`1u`, wgsl`${value}.edgesOffset` )}
         ${storeStatement( wgsl`2u`, wgsl`${value}.numEdges` )}
         ${storeStatement( wgsl`3u`, wgsl`select( 0u, 1u, ${value}.isFullArea )` )}
         ${storeStatement( wgsl`4u`, wgsl`select( 0u, 1u, ${value}.needsFace )` )}
         ${storeStatement( wgsl`5u`, wgsl`bitcast<u32>( ${value}.area )` )}
         ${storeStatement( wgsl`6u`, wgsl`bitcast<u32>( ${value}.minX )` )}
         ${storeStatement( wgsl`7u`, wgsl`bitcast<u32>( ${value}.minY )` )}
         ${storeStatement( wgsl`8u`, wgsl`bitcast<u32>( ${value}.maxX )` )}
         ${storeStatement( wgsl`9u`, wgsl`bitcast<u32>( ${value}.maxY )` )}
         ${storeStatement( wgsl`10u`, wgsl`bitcast<u32>( ${value}.minXCount )` )}
         ${storeStatement( wgsl`11u`, wgsl`bitcast<u32>( ${value}.minYCount )` )}
         ${storeStatement( wgsl`12u`, wgsl`bitcast<u32>( ${value}.maxXCount )` )}
         ${storeStatement( wgsl`13u`, wgsl`bitcast<u32>( ${value}.maxYCount )` )}
      `;
    },
    wgslAlign: 4 * 16, // possibly wrong?
    wgslSize: 4 * 14,

    generateRandom: ( fullSize = false ) => {
      throw new Error( 'unimplemented' );
    },

    toDebugString: ( value: Config ) => 'Config'
  };

  // TODO: figure out better types for this
  const configSlot = new BufferSlot( configType );
  const instructionsSlot = new BufferArraySlot( getArrayType( U32Type, MAX_RENDER_INSTRUCTIONS ) );
  const edgesSlot = new BufferArraySlot( getArrayType( F32Type, 4 * Math.max( 4, edges.length ) ) );
  const outputSlot = new BufferArraySlot( getArrayType( F32Type, 4 ) );

  const module = new DirectModule<number>( {
    name: `module_${name}`,
    main: new WGSLMainModule( [
      new WGSLSlot( 'config', configSlot, BufferBindingType.UNIFORM ),
      new WGSLSlot( 'render_program_instructions', instructionsSlot, BufferBindingType.READ_ONLY_STORAGE ),
      new WGSLSlot( 'complete_edges', edgesSlot, BufferBindingType.READ_ONLY_STORAGE ),
      new WGSLSlot( 'output', outputSlot, BufferBindingType.STORAGE )
    ], wgsl`


      @compute @workgroup_size(1)
      fn main(
        @builtin(global_invocation_id) global_id: vec3u,
        @builtin(local_invocation_id) local_id: vec3u,
        @builtin(workgroup_id) workgroup_id: vec3u
      ) {
        let result: vec4f = ${evaluate_render_program_instructionsWGSL(
      wgsl`config.render_program_index`,
      wgsl`config.edgesOffset`,
      wgsl`config.numEdges`,
      wgsl`config.isFullArea != 0u`,
      wgsl`config.needsFace != 0u`,
      wgsl`config.area`,
      wgsl`config.minX`,
      wgsl`config.minY`,
      wgsl`config.maxX`,
      wgsl`config.maxY`,
      wgsl`config.minXCount`,
      wgsl`config.minYCount`,
      wgsl`config.maxXCount`,
      wgsl`config.maxYCount`,
      {
        getRenderProgramInstruction: index => wgsl`render_program_instructions[ ${index} ]`,
        getLinearEdge: index => wgsl`${LinearEdgeWGSL}( vec2( complete_edges[ 4u * ${index} ], complete_edges[ 4 * ${index} + 1u ] ), vec2( complete_edges[ 4u * ${index} + 2u ], complete_edges[ 4u * ${index} + 3u ] ) )`
      }
    )};
        
        // TODO: typing
        output[ 0u ] = result.x;
        output[ 1u ] = result.y;
        output[ 2u ] = result.z;
        output[ 3u ] = result.w;
      }
    ` ),
    setDispatchSize: ( dispatchSize: Vector3, size: number ) => {
      dispatchSize.x = size;
    }
  } );

  const configEncoder = new ByteEncoder();
  // TODO: test offsets?
  configEncoder.pushU32( 0 ); // render_program_index: u32,
  configEncoder.pushU32( edgesOffset ); // edgesOffset: u32,
  configEncoder.pushU32( numEdges ); // numEdges: u32,
  configEncoder.pushU32( isFullArea ? 1 : 0 ); // isFullArea: u32, // 1 or 0
  configEncoder.pushU32( needsFace ? 1 : 0 ); // needsFace: u32, // 1 or 0
  configEncoder.pushF32( area ); // area: f32,
  configEncoder.pushF32( bounds.minX ); // minX: f32,
  configEncoder.pushF32( bounds.minY ); // minY: f32,
  configEncoder.pushF32( bounds.maxX ); // maxX: f32,
  configEncoder.pushF32( bounds.maxY ); // maxY: f32,
  configEncoder.pushI32( minXCount ); // minXCount: i32,
  configEncoder.pushI32( minYCount ); // minYCount: i32,
  configEncoder.pushI32( maxXCount ); // maxXCount: i32,
  configEncoder.pushI32( maxYCount ); // maxYCount: i32

  const routine = await Routine.create(
    deviceContext,
    module,
    [ configSlot, instructionsSlot, edgesSlot, outputSlot ],
    Routine.INDIVIDUAL_LAYOUT_STRATEGY,
    ( context, execute, input: { config: Config; renderProgram: RenderProgram; edges: LinearEdge[] } ) => {

      const instructions: RenderInstruction[] = [];
      input.renderProgram.writeInstructions( instructions );

      const instructionEncoder = new ByteEncoder();
      RenderInstruction.instructionsToBinary( instructionEncoder, instructions );

      console.groupCollapsed( 'Instructions' );
      console.log( instructions.map( instruction => instruction.toString() ).join( '\n' ) );
      console.log( instructionEncoder.getDebug32String() );
      console.groupEnd();

      assert && assert( instructionEncoder.byteLength < MAX_RENDER_INSTRUCTIONS / 4 );

      context.setTypedBufferValue( configSlot, input.config );
      context.setTypedBufferValue( instructionsSlot, [ ...instructionEncoder.u32Array ] ); // TODO: better typing?!?
      context.setTypedBufferValue( edgesSlot, edges.flatMap( edge => [
        edge.startPoint.x,
        edge.startPoint.y,
        edge.endPoint.x,
        edge.endPoint.y
      ] ) );

      execute( context, 1 );

      return context.getTypedBufferValue( outputSlot );
    }
  );

  const procedure = new Procedure( routine ).bindRemainingBuffers();

  const values = await procedure.standaloneExecute( deviceContext, {
    config: new Config(
      0, // render_program_index: u32,
      edgesOffset, // edgesOffset: u32,
      numEdges, // numEdges: u32,
      isFullArea, // isFullArea: u32, // 1 or 0
      needsFace, // needsFace: u32, // 1 or 0
      area, // area: f32,
      bounds.minX, // minX: f32,
      bounds.minY, // minY: f32,
      bounds.maxX, // maxX: f32,
      bounds.maxY, // maxY: f32,
      minXCount, // minXCount: i32,
      minYCount, // minYCount: i32,
      maxXCount, // maxXCount: i32,
      maxYCount // maxYCount: i32
    ),
    renderProgram: renderProgram,
    edges: edges
  } );

  procedure.dispose();

  assert && assert( values.length === 4 );
  return new Vector4( values[ 0 ], values[ 1 ], values[ 2 ], values[ 3 ] );
};

const renderProgramTest = (
  name: string,
  renderProgram: RenderProgram,
  skip = false
) => {
  asyncTestWithDevice( name, async ( device, deviceContext ) => {
    const context = new RenderEvaluationContext().set(
      null, 1, new Vector2( 0.5, 0.5 ), 0, 0, 1, 1
    );

    const actualValue = await renderProgramComputeEvaluate(
      name,
      deviceContext,
      renderProgram,
      0, // edgesOffset
      0, // numEdges
      [], // edges
      true, // isFullArea
      false, // needsFace
      1, // area
      new Bounds2( 0, 0, 1, 1 ), // bounds
      -1, 1, 1, -1 // counts
    );
    const expectedValue = renderProgram.evaluate( context );

    console.log( 'actual', actualValue );
    console.log( 'expected', expectedValue );

    if ( !actualValue.equalsEpsilon( expectedValue, 1e-5 ) ) {
      return `${name} actual: ${actualValue} expected: ${expectedValue}`;
    }
    else {
      return null;
    }
  } );
};

renderProgramTest(
  'Simple Color',
  new RenderColor( new Vector4( 0.125, 0.25, 0.5, 1 ) )
);

renderProgramTest(
  'Premultiply',
  new RenderPremultiply( new RenderColor( new Vector4( 0.25, 0.5, 1, 0.5 ) ) )
);

renderProgramTest(
  'Unpremultiply',
  new RenderUnpremultiply( new RenderColor( new Vector4( 0.125, 0.25, 0.5, 0.5 ) ) )
);

renderProgramTest(
  'Unpremultiply Zero',
  new RenderUnpremultiply( new RenderColor( new Vector4( 0, 0, 0, 0 ) ) )
);

renderProgramTest(
  'Unpremultiply Small',
  new RenderUnpremultiply( new RenderColor( new Vector4( 1e-6, 1e-6, 1e-6, 1e-6 ) ) )
);

renderProgramTest(
  'RenderSRGBToLinearSRGB',
  new RenderSRGBToLinearSRGB( new RenderColor( new Vector4( 0.5, 0.5, 0.5, 1 ) ) )
);

renderProgramTest(
  'RenderLinearSRGBToSRGB',
  new RenderLinearSRGBToSRGB( new RenderColor( new Vector4( 0.5, 0.5, 0.5, 1 ) ) )
);

renderProgramTest(
  'RenderLinearDisplayP3ToLinearSRGB',
  new RenderLinearDisplayP3ToLinearSRGB( new RenderColor( new Vector4( 0.5, 0.5, 0.5, 1 ) ) )
);

renderProgramTest(
  'RenderLinearSRGBToLinearDisplayP3',
  new RenderLinearSRGBToLinearDisplayP3( new RenderColor( new Vector4( 0.5, 0.5, 0.5, 1 ) ) )
);

renderProgramTest(
  'RenderOklabToLinearSRGB',
  new RenderOklabToLinearSRGB( new RenderColor( new Vector4( 0.5, 0.5, 0.5, 1 ) ) )
);

renderProgramTest(
  'RenderLinearSRGBToOklab',
  new RenderLinearSRGBToOklab( new RenderColor( new Vector4( 0.5, 0.5, 0.5, 1 ) ) )
);

renderProgramTest(
  'RenderNormalize',
  new RenderNormalize( new RenderColor( new Vector4( 0.5, 0.5, 0.5, 1 ) ) )
);

renderProgramTest(
  'RenderAlpha',
  new RenderAlpha( new RenderColor( new Vector4( 0.5, 0.5, 0.5, 1 ) ), 0.5 )
);

renderProgramTest(
  'RenderNormalDebug',
  new RenderNormalDebug( new RenderColor( new Vector4( -0.7, 0.5, -0.3, 0 ) ) )
);

renderProgramTest(
  'RenderStack Fully Opaque',
  new RenderStack( [
    new RenderColor( new Vector4( 1, 0, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 1, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 0, 1, 1 ) )
  ] )
);

renderProgramTest(
  'RenderStack Partially Opaque',
  new RenderStack( [
    new RenderColor( new Vector4( 1, 0, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 1, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 0, 0.5, 0.5 ) )
  ] )
);

renderProgramTest(
  'RenderStack More Partially Opaque',
  new RenderStack( [
    new RenderColor( new Vector4( 1, 0, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 0.5, 0, 0.5 ) ),
    new RenderColor( new Vector4( 0, 0, 0.5, 0.5 ) )
  ] )
);

renderProgramTest(
  'Simple Linear Blend',
  new RenderLinearBlend(
    new Vector2( 1, 0 ),
    0.25,
    RenderLinearBlendAccuracy.Accurate,
    new RenderColor( new Vector4( 1, 0, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 1, 0, 1 ) )
  )
);

renderProgramTest(
  'Simple (BUT CENTROID) Radial Blend',
  new RenderRadialBlend(
    Matrix3.scaling( 2 ),
    0,
    0.5,
    RenderRadialBlendAccuracy.Centroid,
    new RenderColor( new Vector4( 1, 0, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 1, 0, 1 ) )
  )
);

renderProgramTest(
  'RenderLinearGradient A',
  new RenderLinearGradient(
    Matrix3.IDENTITY,
    new Vector2( 0, 0 ),
    new Vector2( 1, 0 ),
    [
      new RenderGradientStop( 0, new RenderColor( new Vector4( 1, 0, 0, 1 ) ) ),
      new RenderGradientStop( 0.2, new RenderColor( new Vector4( 0, 1, 0, 1 ) ) ),
      new RenderGradientStop( 1, new RenderColor( new Vector4( 0, 0, 1, 1 ) ) )
    ],
    RenderExtend.Pad,
    RenderLinearGradientAccuracy.SplitAccurate
  )
);

renderProgramTest(
  'RenderLinearGradient B',
  new RenderLinearGradient(
    Matrix3.IDENTITY,
    new Vector2( 0, 0 ),
    new Vector2( 1, 0 ),
    [
      new RenderGradientStop( 0, new RenderColor( new Vector4( 1, 0, 0, 1 ) ) ),
      new RenderGradientStop( 0.7, new RenderColor( new Vector4( 0, 1, 0, 1 ) ) ),
      new RenderGradientStop( 1, new RenderColor( new Vector4( 0, 0, 1, 1 ) ) )
    ],
    RenderExtend.Pad,
    RenderLinearGradientAccuracy.SplitAccurate
  )
);

renderProgramTest(
  'RenderRadialGradient A',
  new RenderRadialGradient(
    Matrix3.IDENTITY,
    new Vector2( 0, 0 ),
    0,
    new Vector2( 0, 0 ),
    1,
    [
      new RenderGradientStop( 0, new RenderColor( new Vector4( 1, 0, 0, 1 ) ) ),
      new RenderGradientStop( 0.1, new RenderColor( new Vector4( 0, 1, 0, 1 ) ) ),
      new RenderGradientStop( 1, new RenderColor( new Vector4( 0, 0, 1, 1 ) ) )
    ],
    RenderExtend.Pad,
    RenderRadialGradientAccuracy.SplitAccurate
  )
);

renderProgramTest(
  'RenderRadialGradient B',
  new RenderRadialGradient(
    Matrix3.IDENTITY,
    new Vector2( 0, 0 ),
    0,
    new Vector2( 0, 0 ),
    1,
    [
      new RenderGradientStop( 0, new RenderColor( new Vector4( 1, 0, 0, 1 ) ) ),
      new RenderGradientStop( 0.9, new RenderColor( new Vector4( 0, 1, 0, 1 ) ) ),
      new RenderGradientStop( 1, new RenderColor( new Vector4( 0, 0, 1, 1 ) ) )
    ],
    RenderExtend.Pad,
    RenderRadialGradientAccuracy.SplitAccurate
  )
);

renderProgramTest(
  'RenderBarycentricBlend',
  new RenderBarycentricBlend(
    new Vector2( -2, -2 ),
    new Vector2( 6, -2 ),
    new Vector2( -2, 4 ),
    RenderBarycentricBlendAccuracy.Accurate,
    new RenderColor( new Vector4( 1, 0, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 1, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 0, 1, 1 ) )
  )
);

renderProgramTest(
  'RenderBarycentricPerspectiveBlend',
  new RenderBarycentricPerspectiveBlend(
    new Vector3( -2, -2, 4 ),
    new Vector3( 6, -2, 5 ),
    new Vector3( -2, 4, 6 ),
    RenderBarycentricPerspectiveBlendAccuracy.Centroid,
    new RenderColor( new Vector4( 1, 0, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 1, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 0, 1, 1 ) )
  )
);

const composes = [
  'Over',
  'In',
  'Out',
  'Atop',
  'Xor',
  'Plus',
  'PlusLighter'
] as const;

for ( const compose of composes ) {
  renderProgramTest(
    `RenderBlendCompose ${compose} Normal`,
    new RenderBlendCompose(
      RenderComposeType[ compose ],
      RenderBlendType.Normal,
      new RenderColor( new Vector4( 0.1, 0.2, 0.3, 0.4 ) ),
      new RenderColor( new Vector4( 0.8, 0.6, 0.4, 0.9 ) )
    )
  );
}

const blends = [
  'Normal',
  'Multiply',
  'Screen',
  'Overlay',
  'Darken',
  'Lighten',
  'ColorDodge',
  'ColorBurn',
  'HardLight',
  'SoftLight',
  'Difference',
  'Exclusion',
  'Hue',
  'Saturation',
  'Color',
  'Luminosity'
] as const;

for ( const blend of blends ) {
  renderProgramTest(
    `RenderBlendCompose Over ${blend}`,
    new RenderBlendCompose(
      RenderComposeType.Over,
      RenderBlendType[ blend ],
      new RenderColor( new Vector4( 0.1, 0.2, 0.3, 0.4 ) ),
      new RenderColor( new Vector4( 0.8, 0.6, 0.4, 0.9 ) )
    )
  );
}

renderProgramTest(
  'RenderPhong',
  new RenderPhong(
    50,
    new RenderColor( new Vector4( 0.1, 0.2, 0.3, 0.3 ) ), // ambient
    new RenderColor( new Vector4( 0.1, 0.1, 0.1, 1 ) ), // diffuse
    new RenderColor( new Vector4( 0.2, 0.2, 0.2, 1 ) ), // specular
    new RenderColor( new Vector4( 0, 0, 5, 0 ) ), // position
    new RenderColor( new Vector4( 0, 1, 0, 0 ) ), // normal
    [
      new RenderLight(
        new RenderColor( new Vector4( -2.0, 3.5, -2.0, 0 ).normalized() ),
        new RenderColor( new Vector4( 0.9, 0.8, 0.7, 1 ) )
      )
    ]
  )
);

renderProgramTest(
  'RenderFilter',
  new RenderFilter(
    new RenderColor( new Vector4( 0.4, 0.5, 0.6, 0.7 ) ),
    new Matrix4(
      -0.4, 0.5, -0.6, -0.7,
      1, -0.5, 0.6, 3,
      -0.4, 0.5, -0.6, -0.7,
      -4, -0.5, 2, 0.7
    ),
    new Vector4( 0.01, 0.02, 0.03, 0.04 )
  )
);