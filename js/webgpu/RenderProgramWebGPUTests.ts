// Copyright 2023, University of Colorado Boulder

/**
 * Testing RenderProgram execution with WebGPU
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { DeviceContext, RenderAlpha, RenderBarycentricBlend, RenderBarycentricBlendAccuracy, RenderColor, RenderEvaluationContext, RenderLinearBlend, RenderLinearBlendAccuracy, RenderLinearDisplayP3ToLinearSRGB, RenderLinearSRGBToLinearDisplayP3, RenderLinearSRGBToOklab, RenderLinearSRGBToSRGB, RenderNormalize, RenderOklabToLinearSRGB, RenderPremultiply, RenderProgram, RenderSRGBToLinearSRGB, RenderStack, RenderUnpremultiply, TestRenderProgram } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Vector2 from '../../../dot/js/Vector2.js';

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
    new RenderColor( new Vector4( 0, 0, 1, 0.5 ) )
  ] )
);

renderProgramTest(
  'RenderStack More Partially Opaque',
  new RenderStack( [
    new RenderColor( new Vector4( 1, 0, 0, 1 ) ),
    new RenderColor( new Vector4( 0, 1, 0, 0.5 ) ),
    new RenderColor( new Vector4( 0, 0, 1, 0.5 ) )
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
