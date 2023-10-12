// Copyright 2023, University of Colorado Boulder

/**
 * Testing RenderProgram execution with WebGPU
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { DeviceContext, RenderColor, RenderEvaluationContext, RenderProgram, TestRenderProgram } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';

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
