// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL example tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BlitShader, ComputeShader, DeviceContext, wgsl_copy_storage_operation, wgsl_expensive_operation, wgsl_fake_combine_to_texture } from '../imports.js';
import Random from '../../../dot/js/Random.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

export default class PerformanceTesting {
  public static async loopExpensiveMultiple(): Promise<void> {
    const device = await DeviceContext.getDevice();
    if ( !device ) {
      return;
    }

    const numWorkgroups = 16 * 16;
    const workgroupSize = 256;

    const deviceContext = new DeviceContext( device );

    const copyStorageShader = ComputeShader.fromSource(
      device, 'copy_storage_operation', wgsl_copy_storage_operation, [
        Binding.STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
      workgroupSize: workgroupSize
    } );

    const expensiveShader = ComputeShader.fromSource(
      device, 'expensive_operation', wgsl_expensive_operation, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize
      }
    );

    const fakeCombineShader = ComputeShader.fromSource(
      device, 'fake_combine_to_texture', wgsl_fake_combine_to_texture, [
        Binding.STORAGE_BUFFER,
        Binding.STORAGE_BUFFER,
        Binding.STORAGE_BUFFER,
        Binding.STORAGE_BUFFER,
        deviceContext.preferredStorageFormat === 'bgra8unorm' ? Binding.TEXTURE_OUTPUT_BGRA8UNORM : Binding.TEXTURE_OUTPUT_RGBA8UNORM
      ], {
        workgroupSize: 1,
        preferredStorageFormat: deviceContext.preferredStorageFormat
      }
    );

    const blitShader = new BlitShader( device, deviceContext.preferredCanvasFormat );

    const canvas = document.createElement( 'canvas' );
    canvas.width = 16;
    canvas.height = 16;
    document.body.appendChild( canvas );
    const canvasContext = deviceContext.getCanvasContext( canvas, 'srgb' );

    await ( async function step() {
      // @ts-expect-error LEGACY --- it would know to update just the DOM element's location if it's the second argument
      window.requestAnimationFrame( step, canvas );

      const numbers = new Float32Array( _.range( 0, workgroupSize * numWorkgroups ).map( () => random.nextDouble() - 0.5 ) );
      const bufferSize = numbers.byteLength;

      const outTexture = canvasContext.getCurrentTexture();

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

      const buffersToDestroy: GPUBuffer[] = [];

      const inputBuffer = deviceContext.createBuffer( bufferSize );
      device.queue.writeBuffer( inputBuffer, 0, numbers.buffer );
      buffersToDestroy.push( inputBuffer );

      const middleBuffer = deviceContext.createBuffer( bufferSize );
      buffersToDestroy.push( middleBuffer );

      const outputBufferA = deviceContext.createBuffer( bufferSize );
      const outputBufferB = deviceContext.createBuffer( bufferSize );
      const outputBufferC = deviceContext.createBuffer( bufferSize );
      const outputBufferD = deviceContext.createBuffer( bufferSize );
      buffersToDestroy.push( outputBufferA );
      buffersToDestroy.push( outputBufferB );
      buffersToDestroy.push( outputBufferC );
      buffersToDestroy.push( outputBufferD );

      const encoder = device.createCommandEncoder( { label: 'the encoder' } );

      copyStorageShader.dispatch( encoder, [
        inputBuffer, middleBuffer
      ] );

      expensiveShader.dispatch( encoder, [
        middleBuffer, outputBufferA
      ], numWorkgroups );
      expensiveShader.dispatch( encoder, [
        middleBuffer, outputBufferB
      ], numWorkgroups );
      expensiveShader.dispatch( encoder, [
        middleBuffer, outputBufferC
      ], numWorkgroups );
      expensiveShader.dispatch( encoder, [
        middleBuffer, outputBufferD
      ], numWorkgroups );

      fakeCombineShader.dispatch( encoder, [
        outputBufferA, outputBufferB, outputBufferC, outputBufferD, fineOutputTextureView
      ], 1 );

      if ( !canOutputToCanvas ) {
        assert && assert( fineOutputTexture, 'If we cannot output to the Canvas directly, we will have created a texture' );

        blitShader.dispatch( encoder, outTextureView, fineOutputTextureView );
      }

      const commandBuffer = encoder.finish();
      device.queue.submit( [ commandBuffer ] );

      buffersToDestroy.forEach( buffer => buffer.destroy() );
    } )();
  }
}

alpenglow.register( 'PerformanceTesting', PerformanceTesting );