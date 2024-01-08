// Copyright 2023, University of Colorado Boulder

/**
 * For testing overlapping (parallel) execution of shader stages that don't write to the same memory.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, OldBindingType, BlitShader, OldComputeShader, DeviceContext, wgsl_copy_storage_operation, wgsl_expensive_operation, wgsl_fake_combine_to_texture, U32Order, BufferArraySlot, getArrayType, RadixSortModule, Routine, Procedure, u32 } from '../imports.js';
import Random from '../../../dot/js/Random.js';
import Utils from '../../../dot/js/Utils.js';

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

    const copyStorageShader = OldComputeShader.fromSource(
      device, 'copy_storage_operation', wgsl_copy_storage_operation, [
        OldBindingType.STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
      workgroupSize: workgroupSize
    } );

    const expensiveShader = OldComputeShader.fromSource(
      device, 'expensive_operation', wgsl_expensive_operation, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize
      }
    );

    const fakeCombineShader = OldComputeShader.fromSource(
      device, 'fake_combine_to_texture', wgsl_fake_combine_to_texture, [
        OldBindingType.STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER,
        deviceContext.preferredStorageFormat === 'bgra8unorm' ? OldBindingType.TEXTURE_OUTPUT_BGRA8UNORM : OldBindingType.TEXTURE_OUTPUT_RGBA8UNORM
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

  public static async loopRadixSortTest(
    combineStrategy: boolean,
    separateComputePasses: boolean
  ): Promise<void> {
    const countPerFrame = 100;

    const inputSize = 4000;
    // const inputSize = workgroupSize * workgroupSize * ( 6 ) - 27 * 301;
    // const inputSize = workgroupSize * workgroupSize * ( workgroupSize - 3 ) - 27 * 301;
    // eslint-disable-next-line bad-sim-text
    const uintNumbers = new Uint32Array( _.range( 0, inputSize ).map( () => Math.floor( Math.random() * 1000000 ) ) );

    const device = ( await DeviceContext.getDevice() )!;
    const deviceContext = new DeviceContext( device );

    const order = U32Order;
    const size = inputSize;
    const maximumSize = inputSize + 100;

    const inputSlot = new BufferArraySlot( getArrayType( order.type, maximumSize ) );
    const outputSlot = new BufferArraySlot( getArrayType( order.type, maximumSize ) );

    const radixSortModule = new RadixSortModule( {
      input: inputSlot,
      output: outputSlot,
      name: 'performance test',

      order: order,
      totalBits: 32,

      radixWorkgroupSize: 64,
      radixGrainSize: 4,
      scanWorkgroupSize: 64,
      scanGrainSize: 4,

      lengthExpression: u32( size ),

      bitsPerPass: 2, // TODO: try 8 once we are doing more
      bitsPerInnerPass: 2,
      earlyLoad: false,
      scanModuleOptions: {
        areScannedReductionsExclusive: false
      }
    } );

    const routine = await Routine.create(
      deviceContext,
      radixSortModule,
      [ inputSlot, outputSlot ],
      combineStrategy ? Routine.COMBINE_ALL_LAYOUT_STRATEGY : Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      async ( context, execute, input: number[] ) => {
        context.setTypedBufferValue( inputSlot, input );

        for ( let i = 0; i < countPerFrame; i++ ) {
          execute( context, input.length );
        }
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    let startTime: DOMHighResTimeStamp | null = null;
    let countElapsed = 0;
    const elapsedTimes: number[] = [];

    const step = async () => {
      requestAnimationFrame( step );

      if ( startTime === null ) {
        startTime = performance.now();
      }

      countElapsed++;

      if ( countElapsed % 500 === 0 ) {
        const now = performance.now();
        const elapsed = now - startTime;
        startTime = now;
        elapsedTimes.push( elapsed );
        console.log( Utils.toFixed( elapsed, 0 ), elapsedTimes.length > 1 ? Utils.toFixed( _.sum( elapsedTimes.slice( 1 ) ) / elapsedTimes.slice( 1 ).length, 0 ) : 0 );
      }

      // TODO: maybe avoid the await on the first frame?

      // TODO: accept typed arrays and get things working more efficiently!
      await procedure.standaloneExecute( deviceContext, [ ...uintNumbers ], {
        procedureExecuteOptions: {
          separateComputePasses: separateComputePasses
        }
      } );
    };
    await step();
  }
}

alpenglow.register( 'PerformanceTesting', PerformanceTesting );
