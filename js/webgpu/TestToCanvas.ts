// Copyright 2023, University of Colorado Boulder

/**
 * Testing for rasterization
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BlitShader, ComputeShader, DeviceContext, DualSnippet, wgsl_bounds_double_area_edge } from '../imports.js';
import Vector3 from '../../../dot/js/Vector3.js';

export default class TestToCanvas {

  // phet.alpenglow.TestToCanvas.render().then( c => document.body.appendChild( c ) )
  public static async render(): Promise<HTMLCanvasElement> {
    const device = ( await DeviceContext.getDevice() )!;
    assert && assert( device );

    const deviceContext = new DeviceContext( device );
    const canvas = document.createElement( 'canvas' );
    canvas.width = 256 * window.devicePixelRatio;
    canvas.height = 256 * window.devicePixelRatio;
    canvas.style.width = '256px';
    canvas.style.height = '256px';

    const context = deviceContext.getCanvasContext( canvas );

    const outTexture = context.getCurrentTexture();

    const configBuffer = device.createBuffer( {
      label: 'config buffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    } );
    device.queue.writeBuffer( configBuffer, 0, new Uint32Array( [
      3
    ] ).buffer );

    const dataBuffer = deviceContext.createBuffer( 512 );
    device.queue.writeBuffer( dataBuffer, 0, new Float32Array( [
      32, 32,
      512 - 32, 32,
      512 - 32, 32,
      512 - 32, 512 - 32,
      512 - 32, 512 - 32,
      32, 32
    ] ).buffer );

    const snippet = new DualSnippet( `
struct Config {
  num_edges: u32
}

@group(0) @binding(0)
var<uniform> config: Config;
@group(0) @binding(1)
var output: texture_storage_2d<${deviceContext.preferredStorageFormat}, write>;
@group(0) @binding(2)
var<storage> vertices: array<f32>;
    `, `
@compute @workgroup_size(16, 16)
fn main(
    @builtin(global_invocation_id) global_id: vec3u,
    @builtin(local_invocation_id) local_id: vec3u,
    @builtin(workgroup_id) wg_id: vec3u,
) {
  let p = vec2f( global_id.xy );
  // textureStore( output, global_id.xy, vec4( select( 0.0, 1.0, distance( p, vec2( 256.0, 256.0 ) ) < 100.0 ), 0.0, 0.0, 1.0 ) );
  // textureStore( output, global_id.xy, vec4( select( 0.0, 1.0, config.num_edges > 2 ), 0.0, 0.0, 1.0 ) );
  textureStore( output, global_id.xy, vec4( select( 0.0, 1.0, p.x < 5.0 ), 0.0, 0.0, 1.0 ) );
}
    `, [
      DualSnippet.fromSource( wgsl_bounds_double_area_edge, {} )
    ] );
    // TODO: replacements, for things like the texture storage

    const shader = new ComputeShader( 'shader', snippet.toString(), [
      Binding.UNIFORM_BUFFER,
      deviceContext.preferredStorageFormat === 'bgra8unorm' ? Binding.TEXTURE_OUTPUT_BGRA8UNORM : Binding.TEXTURE_OUTPUT_RGBA8UNORM,
      Binding.STORAGE_BUFFER
    ], device );
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

    // Have the fine-rasterization shader use the preferred format as output (for now)
    shader.dispatch( encoder, new Vector3( 32, 32, 1 ), [
      configBuffer, fineOutputTextureView, dataBuffer
    ] );

    if ( !canOutputToCanvas ) {
      assert && assert( fineOutputTexture, 'If we cannot output to the Canvas directly, we will have created a texture' );

      blitShader.dispatch( encoder, outTextureView, fineOutputTextureView );
    }

    const commandBuffer = encoder.finish();
    device.queue.submit( [ commandBuffer ] );

    // // Conditionally listen to when the submitted work is done
    // if ( onCompleteActions.length ) {
    //   device.queue.onSubmittedWorkDone().then( () => {
    //     onCompleteActions.forEach( action => action() );
    //   } ).catch( err => {
    //     throw err;
    //   } );
    // }

    configBuffer.destroy();
    fineOutputTexture && fineOutputTexture.destroy();

    // TODO: dispose the device context once we are all done?

    return canvas;
  }
}

alpenglow.register( 'TestToCanvas', TestToCanvas );