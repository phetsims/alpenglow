// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import Vector4 from '../../../../../dot/js/Vector4.js';
import { wgsl, WGSLMainModule, WGSLSlot, WGSLString } from '../../wgsl/WGSLString.js';
import { asyncTestWithDevice } from '../ShaderTestUtils.js';
import { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { DirectModule } from '../../compute/DirectModule.js';
import { F32Type, getArrayType } from '../../compute/ConcreteType.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';
import { Routine } from '../../compute/Routine.js';
import { Procedure } from '../../compute/Procedure.js';
import { sRGB_to_linear_sRGBWGSL } from '../../wgsl/color/sRGB_to_linear_sRGBWGSL.js';
import { RenderColor } from '../../../render-program/RenderColor.js';
import { linear_sRGB_to_sRGBWGSL } from '../../wgsl/color/linear_sRGB_to_sRGBWGSL.js';
import { premultiplyWGSL } from '../../wgsl/color/premultiplyWGSL.js';
import { unpremultiplyWGSL } from '../../wgsl/color/unpremultiplyWGSL.js';
import { linear_sRGB_to_oklabWGSL } from '../../wgsl/color/linear_sRGB_to_oklabWGSL.js';
import { oklab_to_linear_sRGBWGSL } from '../../wgsl/color/oklab_to_linear_sRGBWGSL.js';
import { linear_displayP3_to_linear_sRGBWGSL } from '../../wgsl/color/linear_displayP3_to_linear_sRGBWGSL.js';
import { linear_sRGB_to_linear_displayP3WGSL } from '../../wgsl/color/linear_sRGB_to_linear_displayP3WGSL.js';
import { gamut_map_linear_sRGBWGSL } from '../../wgsl/color/gamut_map_linear_sRGBWGSL.js';
import { gamut_map_linear_displayP3WGSL } from '../../wgsl/color/gamut_map_linear_displayP3WGSL.js';
import { gamut_map_premul_sRGBWGSL } from '../../wgsl/color/gamut_map_premul_sRGBWGSL.js';
import { gamut_map_premul_displayP3WGSL } from '../../wgsl/color/gamut_map_premul_displayP3WGSL.js';

QUnit.module( 'ColorTests' );

const vec3Test = (
  name: string,
  wgslFunction: ( input: WGSLString ) => WGSLString,
  f: ( v: Vector3 ) => Vector3,
  inputVectors: Vector3[]
) => {
  asyncTestWithDevice( name, async ( device, deviceContext ) => {
    const inputSlot = new BufferArraySlot( getArrayType( F32Type, 3 * inputVectors.length ) );
    const outputSlot = new BufferArraySlot( getArrayType( F32Type, 3 * inputVectors.length ) );

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
          
          let in = i * 3u;
          let out = i * 3u;
          let a = vec3( input[ in + 0u ], input[ in + 1u ], input[ in + 2u ] );
          let c = ${wgslFunction( wgsl`a` )};
          output[ out + 0u ] = c.x;
          output[ out + 1u ] = c.y;
          output[ out + 2u ] = c.z;
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

        execute( context, inputVectors.length );

        return context.getTypedBufferValue( outputSlot );
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    const actualValues = await procedure.standaloneExecute( deviceContext, inputVectors.flatMap( v => [
      v.x, v.y, v.z
    ] ) );
    const actualVectors = _.range( 0, inputVectors.length ).map( i => new Vector3(
      actualValues[ i * 3 ],
      actualValues[ i * 3 + 1 ],
      actualValues[ i * 3 + 2 ]
    ) );

    const expectedVectors = inputVectors.map( f );

    console.log( 'expected', expectedVectors );
    console.log( 'actual', actualVectors );

    procedure.dispose();

    for ( let i = 0; i < inputVectors.length; i++ ) {
      const actual = actualVectors[ i ];
      const expected = expectedVectors[ i ];

      if ( !expected.equalsEpsilon( actual, 1e-4 ) ) {
        return `${name} failure expected: ${expected}, actual: ${actual}, i:${i}`;
      }
    }

    return null;
  } );
};

const vec4Test = (
  name: string,
  wgslFunction: ( input: WGSLString ) => WGSLString,
  f: ( v: Vector4 ) => Vector4,
  inputVectors: Vector4[]
) => {
  asyncTestWithDevice( name, async ( device, deviceContext ) => {
    const inputSlot = new BufferArraySlot( getArrayType( F32Type, 4 * inputVectors.length ) );
    const outputSlot = new BufferArraySlot( getArrayType( F32Type, 4 * inputVectors.length ) );

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
          let out = i * 4u;
          let a = vec4( input[ in + 0u ], input[ in + 1u ], input[ in + 2u ], input[ in + 3u ] );
          let c = ${wgslFunction( wgsl`a` )};
          output[ out + 0u ] = c.x;
          output[ out + 1u ] = c.y;
          output[ out + 2u ] = c.z;
          output[ out + 3u ] = c.w;
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

        execute( context, inputVectors.length );

        return context.getTypedBufferValue( outputSlot );
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    const actualValues = await procedure.standaloneExecute( deviceContext, inputVectors.flatMap( v => [
      v.x, v.y, v.z, v.w
    ] ) );
    const actualVectors = _.range( 0, inputVectors.length ).map( i => new Vector4(
      actualValues[ i * 4 ],
      actualValues[ i * 4 + 1 ],
      actualValues[ i * 4 + 2 ],
      actualValues[ i * 4 + 3 ]
    ) );

    const expectedVectors = inputVectors.map( f );

    console.log( 'expected', expectedVectors );
    console.log( 'actual', actualVectors );

    procedure.dispose();

    for ( let i = 0; i < inputVectors.length; i++ ) {
      const actual = actualVectors[ i ];
      const expected = expectedVectors[ i ];

      if ( !expected.equalsEpsilon( actual, 1e-4 ) ) {
        return `${name} failure expected: ${expected}, actual: ${actual}, i:${i}`;
      }
    }

    return null;
  } );
};

vec3Test(
  'sRGB_to_linear_sRGB',
  sRGB_to_linear_sRGBWGSL,
  ( color: Vector3 ) => RenderColor.sRGBToLinear( color.toVector4() ).toVector3(),
  [
    new Vector3( 0.9, 0.0, 0.0001 ),
    new Vector3( 0.99, 0.5, 0.002 )
  ]
);

vec3Test(
  'linear_sRGB_to_sRGBWGSL',
  linear_sRGB_to_sRGBWGSL,
  ( color: Vector3 ) => RenderColor.linearToSRGB( color.toVector4() ).toVector3(),
  [
    new Vector3( 0.9, 0.0, 0.0001 ),
    new Vector3( 0.99, 0.5, 0.002 )
  ]
);

vec4Test(
  'premultiply',
  premultiplyWGSL,
  ( color: Vector4 ) => RenderColor.premultiply( color ),
  [
    new Vector4( 1, 0.5, 0, 0 ),
    new Vector4( 1, 0.5, 0, 0.25 ),
    new Vector4( 1, 0.5, 0, 1 )
  ]
);

vec4Test(
  'unpremultiply',
  unpremultiplyWGSL,
  ( color: Vector4 ) => RenderColor.unpremultiply( color ),
  [
    new Vector4( 0, 0, 0, 0 ),
    new Vector4( 0.25, 0.125, 0, 0.25 ),
    new Vector4( 1, 0.5, 0, 1 )
  ]
);

vec3Test(
  'linear_sRGB_to_oklab',
  linear_sRGB_to_oklabWGSL,
  ( color: Vector3 ) => RenderColor.linearToOklab( color.toVector4() ).toVector3(),
  [
    new Vector3( 0.9, 0.0, 0.0001 ),
    new Vector3( 0.99, 0.5, 0.002 ),
    new Vector3( 0.5, 0.5, 0.5 ),
    new Vector3( -0.2, 0.5, 0.5 ),
    new Vector3( 0.2, -0.5, 0.5 ),
    new Vector3( 0.2, 0.5, -0.5 ),
    new Vector3( 1.5, 20.5, 0.7 ),
    new Vector3( -0.1, -0.2, -0.3 )
  ]
);

vec3Test(
  'oklab_to_linear_sRGB',
  oklab_to_linear_sRGBWGSL,
  ( color: Vector3 ) => RenderColor.oklabToLinear( color.toVector4() ).toVector3(),
  [
    new Vector3( 0.9, 0.0, 0.0001 ),
    new Vector3( 0.99, 0.5, 0.002 ),
    new Vector3( 0.5, 0.5, 0.5 ),
    new Vector3( -0.02, 0.5, 0.5 ),
    new Vector3( 0.2, -0.05, 0.5 ),
    new Vector3( 0.2, 0.5, -0.05 ),
    new Vector3( 1.5, 2.5, 0.7 ),
    new Vector3( -0.01, -0.02, -0.03 )
  ]
);

vec3Test(
  'linear_displayP3_to_linear_sRGB',
  linear_displayP3_to_linear_sRGBWGSL,
  ( color: Vector3 ) => RenderColor.linearDisplayP3ToLinear( color.toVector4() ).toVector3(),
  [
    new Vector3( 0.9, 0.0, 0.0001 ),
    new Vector3( 0.99, 0.5, 0.002 ),
    new Vector3( 0.5, 0.5, 0.5 )
  ]
);

vec3Test(
  'linear_sRGB_to_linear_displayP3',
  linear_sRGB_to_linear_displayP3WGSL,
  ( color: Vector3 ) => RenderColor.linearToLinearDisplayP3( color.toVector4() ).toVector3(),
  [
    new Vector3( 0.9, 0.0, 0.0001 ),
    new Vector3( 0.99, 0.5, 0.002 ),
    new Vector3( 0.5, 0.5, 0.5 )
  ]
);

vec3Test(
  'gamut_map_linear_sRGB',
  gamut_map_linear_sRGBWGSL,
  ( color: Vector3 ) => RenderColor.gamutMapLinearSRGB( color.toVector4() ).toVector3(),
  [
    new Vector3( 0.2, 0.5, 0.7 ),
    new Vector3( 0, 0, 0 ),
    new Vector3( 1, 1, 1 ),
    new Vector3( -0.2, 0.5, 0.5 ),
    new Vector3( 0.2, -0.5, 0.5 ),
    new Vector3( 0.2, 0.5, -0.5 ),
    new Vector3( 1.5, 20.5, 0.7 ),
    new Vector3( -0.1, -0.2, -0.3 )
  ]
);

vec3Test(
  'gamut_map_linear_displayP3',
  gamut_map_linear_displayP3WGSL,
  ( color: Vector3 ) => RenderColor.gamutMapLinearDisplayP3( color.toVector4() ).toVector3(),
  [
    new Vector3( 0.2, 0.5, 0.7 ),
    new Vector3( 0, 0, 0 ),
    new Vector3( 1, 1, 1 ),
    new Vector3( -0.2, 0.5, 0.5 ),
    new Vector3( 0.2, -0.5, 0.5 ),
    new Vector3( 0.2, 0.5, -0.5 ),
    new Vector3( 1.5, 20.5, 0.7 ),
    new Vector3( -0.1, -0.2, -0.3 )
  ]
);

vec4Test(
  'gamut_map_premul_sRGB',
  gamut_map_premul_sRGBWGSL,
  RenderColor.gamutMapPremultipliedSRGB,
  [
    new Vector4( 0.2, 0.5, 0.7, 1 ),
    new Vector4( 0, 0, 0, 0.2 ),
    new Vector4( 0.5, 0.5, 0.5, 0.5 ),
    new Vector4( -0.2, 0.5, 0.5, 1 ),
    new Vector4( 0.2, -0.5, 0.5, 1 ),
    new Vector4( 0.2, 0.5, -0.05, 0.5 ),
    new Vector4( 1.5, 3.5, 0.7, 1 ),
    new Vector4( -0.1, -0.2, -0.3, 1 )
  ]
);

vec4Test(
  'gamut_map_premul_displayP3',
  gamut_map_premul_displayP3WGSL,
  RenderColor.gamutMapPremultipliedDisplayP3,
  [
    new Vector4( 0.2, 0.5, 0.7, 1 ),
    new Vector4( 0, 0, 0, 0.2 ),
    new Vector4( 0.5, 0.5, 0.5, 0.5 ),
    new Vector4( -0.2, 0.5, 0.5, 1 ),
    new Vector4( 0.2, -0.5, 0.5, 1 ),
    new Vector4( 0.2, 0.5, -0.05, 0.5 ),
    new Vector4( 1.5, 3.5, 0.7, 1 ),
    new Vector4( -0.1, -0.2, -0.3, 1 )
  ]
);