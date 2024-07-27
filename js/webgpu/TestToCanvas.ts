// Copyright 2023-2024, University of Colorado Boulder

/**
 * Testing for rasterization
 *
 * TODO: remove this once we have all of the stubs gone (bounds_double_area_edge.wgsl/test_to_canvas.wgsl is only used by this, etc.)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BlitShader, DeviceContext, OldBindingType, OldComputeShader, wgsl_test_to_canvas } from '../imports.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import testPolygonalFace from './tests/testPolygonalFace.js';

// TODO: deprecate/remove this, but move the getTestPath() elsewhere (since we use it for various things).

export default class TestToCanvas {

  // phet.alpenglow.TestToCanvas.render().then( c => document.body.appendChild( c ) )
  public static async render(): Promise<HTMLCanvasElement> {
    const device = ( await DeviceContext.getDevice() )!;
    assert && assert( device );

    const displaySize = 512;

    const deviceContext = new DeviceContext( device );
    const canvas = document.createElement( 'canvas' );
    canvas.width = displaySize * window.devicePixelRatio;
    canvas.height = displaySize * window.devicePixelRatio;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;

    const context = deviceContext.getCanvasContext( canvas, 'srgb' );

    const outTexture = context.getCurrentTexture();

    const pathEdges = testPolygonalFace.toEdgedFace().edges;
    const pointsWithMatrix = ( matrix: Matrix3 ): number[] => {
      return pathEdges.flatMap( edge => {
        // NOTE: reversed here, due to our test path!!!
        const start = matrix.timesVector2( edge.endPoint );
        const end = matrix.timesVector2( edge.startPoint );

        return [ start.x, start.y, end.x, end.y ];
      } );
    };
    const pathPoints = [
      ...pointsWithMatrix( Matrix3.scaling( 1.5 ) ),
      ...pointsWithMatrix( Matrix3.translation( 150, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 300, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 450, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 600, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 750, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ...pointsWithMatrix( Matrix3.translation( 900, 0 ).timesMatrix( Matrix3.scaling( 0.2 ) ) ),
      ..._.range( 0, 10 ).flatMap( i => {
        return _.range( 0, 4 ).flatMap( j => {
          return pointsWithMatrix( Matrix3.translation( 100 + 40 * i, 800 + 40 * j ).timesMatrix( Matrix3.scaling( 0.05 ) ) );
        } );
      } )
    ];
    console.log( `edge count: ${pathPoints.length / 4}` );

    const configBuffer = device.createBuffer( {
      label: 'config buffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    } );
    device.queue.writeBuffer( configBuffer, 0, new Uint32Array( [
      pathPoints.length / 4
    ] ).buffer );

    const dataBuffer = deviceContext.createBuffer( 4 * pathPoints.length );
    device.queue.writeBuffer( dataBuffer, 0, new Float32Array( pathPoints ).buffer );

    const shader = OldComputeShader.fromSource( device, 'shader', wgsl_test_to_canvas, [
      OldBindingType.UNIFORM_BUFFER,
      deviceContext.preferredStorageFormat === 'bgra8unorm' ? OldBindingType.TEXTURE_OUTPUT_BGRA8UNORM : OldBindingType.TEXTURE_OUTPUT_RGBA8UNORM,
      OldBindingType.READ_ONLY_STORAGE_BUFFER
    ], {
      preferredStorageFormat: deviceContext.preferredStorageFormat
    } );
    const blitShader = new BlitShader( device, deviceContext.preferredCanvasFormat );

    const encoder = device.createCommandEncoder( {
      label: 'the encoder'
    } );

    const canvasTextureFormat = outTexture.format;
    if ( canvasTextureFormat !== 'bgra8unorm' && canvasTextureFormat !== 'rgba8unorm' ) {
      throw new Error( 'unsupported format' );
    }

    const canOutputToCanvas = canvasTextureFormat === deviceContext.preferredStorageFormat;
    let fineOutputTextureView: GPUTextureView;
    let fineOutputTexture: GPUTexture | null = null;
    const outTextureView = outTexture.createView();

    // TODO: factor out this pattern
    if ( canOutputToCanvas ) {
      fineOutputTextureView = outTextureView;
    }
    else {
      fineOutputTexture = device.createTexture( {
        label: 'fineOutputTexture',
        size: {
          width: outTexture.width,
          height: outTexture.height,
          depthOrArrayLayers: 1
        },
        format: deviceContext.preferredStorageFormat,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING // see TargetTexture
      } );
      fineOutputTextureView = fineOutputTexture.createView( {
        label: 'fineOutputTextureView',
        format: deviceContext.preferredStorageFormat,
        dimension: '2d'
      } );
    }

    assert && assert( Number.isInteger( canvas.width / 16 ) );
    assert && assert( Number.isInteger( canvas.height / 16 ) );

    // Have the fine-rasterization shader use the preferred format as output (for now)
    shader.dispatch( encoder, [
      configBuffer, fineOutputTextureView, dataBuffer
    ], canvas.width / 16, canvas.height / 16 );

    if ( !canOutputToCanvas ) {
      assert && assert( fineOutputTexture, 'If we cannot output to the Canvas directly, we will have created a texture' );

      blitShader.dispatch( encoder, outTextureView, fineOutputTextureView );
    }

    const commandBuffer = encoder.finish();
    device.queue.submit( [ commandBuffer ] );

    const startTime = Date.now();

    device.queue.onSubmittedWorkDone().then( () => {
      const endTime = Date.now();

      console.log( endTime - startTime );
    } ).catch( err => {
      throw err;
    } );

    configBuffer.destroy();
    fineOutputTexture && fineOutputTexture.destroy();

    // TODO: dispose the device context once we are all done?

    return canvas;
  }
}

alpenglow.register( 'TestToCanvas', TestToCanvas );