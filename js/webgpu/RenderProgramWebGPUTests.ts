// Copyright 2023, University of Colorado Boulder

/**
 * Testing RenderProgram execution with WebGPU
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { DeviceContext, RenderAlpha, RenderBarycentricBlend, RenderBarycentricBlendAccuracy, RenderBarycentricPerspectiveBlend, RenderBarycentricPerspectiveBlendAccuracy, RenderBlendCompose, RenderBlendType, RenderColor, RenderComposeType, RenderEvaluationContext, RenderFilter, RenderLight, RenderLinearBlend, RenderLinearBlendAccuracy, RenderLinearDisplayP3ToLinearSRGB, RenderLinearSRGBToLinearDisplayP3, RenderLinearSRGBToOklab, RenderLinearSRGBToSRGB, RenderNormalDebug, RenderNormalize, RenderOklabToLinearSRGB, RenderPhong, RenderPremultiply, RenderProgram, RenderRadialBlend, RenderRadialBlendAccuracy, RenderSRGBToLinearSRGB, RenderStack, RenderUnpremultiply, TestRenderProgram } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector3 from '../../../dot/js/Vector3.js';
import Matrix4 from '../../../dot/js/Matrix4.js';
import Matrix3 from '../../../dot/js/Matrix3.js';

QUnit.module( 'TestRenderProgram' );

const devicePromise: Promise<GPUDevice | null> = ( async () => {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    return ( await adapter?.requestDevice() ) || null;
  }
  catch( e ) {
    return null;
  }
} )();

const deviceContextPromise: Promise<DeviceContext | null> = devicePromise.then( device => device ? new DeviceContext( device ) : null );

const renderProgramTest = (
  name: string,
  renderProgram: RenderProgram,
  skip = false
) => {
  ( skip ? QUnit.skip : QUnit.test )( name, async assert => {
    const done = assert.async();

    const deviceContext = await deviceContextPromise;

    if ( !deviceContext ) {
      assert.expect( 0 );
    }
    else {
      const context = new RenderEvaluationContext().set(
        null, 1, phet.dot.v2( 0.5, 0.5 ), 0, 0, 1, 1
      );

      const actualValue = await TestRenderProgram.evaluate(
        deviceContext,
        renderProgram,
        0, // edgesOffset
        0, // numEdges
        [], // edges
        true, // isFullArea
        1, // area
        new phet.dot.Bounds2( 0, 0, 1, 1 ), // bounds
        -1, 1, 1, -1 // counts
      );

      const expectedValue = renderProgram.evaluate( context );

      assert.ok( actualValue.equalsEpsilon( expectedValue, 1e-5 ), `${name} actual: ${actualValue} expected: ${expectedValue}` );
    }

    done();
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

