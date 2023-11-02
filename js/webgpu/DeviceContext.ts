// Copyright 2023, University of Colorado Boulder

/**
 * Handle resources and settings connected to a GPUDevice
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferLogger } from '../imports.js';
import TinyEmitter from '../../../axon/js/TinyEmitter.js';
import optionize from '../../../phet-core/js/optionize.js';

export type PreferredCanvasFormat = 'bgra8unorm' | 'rgba8unorm';

export type DeviceContextDeviceOptions = {
  maxLimits?: boolean;
  timestampQuery?: boolean;
  highPerformance?: boolean;
};

const limitNames = [
  'maxTextureDimension1D',
  'maxTextureDimension2D',
  'maxTextureDimension3D',
  'maxTextureArrayLayers',
  'maxBindGroups',
  // 'maxBindGroupsPlusVertexBuffers',
  'maxBindingsPerBindGroup',
  'maxDynamicUniformBuffersPerPipelineLayout',
  'maxDynamicStorageBuffersPerPipelineLayout',
  'maxSampledTexturesPerShaderStage',
  'maxSamplersPerShaderStage',
  'maxStorageBuffersPerShaderStage',
  'maxStorageTexturesPerShaderStage',
  'maxUniformBuffersPerShaderStage',
  'maxUniformBufferBindingSize',
  'maxStorageBufferBindingSize',
  'minUniformBufferOffsetAlignment',
  'minStorageBufferOffsetAlignment',
  'maxVertexBuffers',
  'maxBufferSize',
  'maxVertexAttributes',
  'maxVertexBufferArrayStride',
  'maxInterStageShaderComponents',
  'maxInterStageShaderVariables',
  'maxColorAttachments',
  'maxColorAttachmentBytesPerSample',
  'maxComputeWorkgroupStorageSize',
  'maxComputeInvocationsPerWorkgroup',
  'maxComputeWorkgroupSizeX',
  'maxComputeWorkgroupSizeY',
  'maxComputeWorkgroupSizeZ',
  'maxComputeWorkgroupsPerDimension'
] as const;

export default class DeviceContext {

  public readonly preferredCanvasFormat: PreferredCanvasFormat;
  public readonly preferredStorageFormat: 'bgra8unorm' | 'rgba8unorm';
  public readonly lostEmitter = new TinyEmitter();

  // NOTE: Not readonly, we'll handle context losses. Perhaps have a Property for the device?
  public constructor( public device: GPUDevice ) {

    this.preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat() as PreferredCanvasFormat;
    assert && assert( this.preferredCanvasFormat === 'bgra8unorm' || this.preferredCanvasFormat === 'rgba8unorm',
      'According to WebGPU documentation, this should only be bgra8unorm or rgba8unorm' );

    this.preferredStorageFormat =
      ( this.preferredCanvasFormat === 'bgra8unorm' && device.features.has( 'bgra8unorm-storage' ) )
      ? 'bgra8unorm'
      : 'rgba8unorm';

    // TODO: handle context losses, reconstruct with the device
    // TODO: get setup to manually trigger context losses
    // TODO: If the GPU is unavailable, we will return ALREADY LOST contexts. We should try an immediate request for a
    // TODO: device once, to see if we get a context back (transient loss), otherwise disable it for a while
    device.lost.then( info => {
      console.error( `WebGPU device was lost: ${info.message}` );

      this.lostEmitter.emit();

      // 'reason' will be 'destroyed' if we intentionally destroy the device.
      if ( info.reason !== 'destroyed' ) {
        // TODO: handle destruction
      }
    } ).catch( err => {
      throw new Error( err );
    } );

    // TODO: We need to listen to leaks, DeviceContext is adding a listener!!!
  }

  // in bytes
  public createBuffer( size: number ): GPUBuffer {
    return this.device.createBuffer( {
      size: Math.max( size, 16 ), // Min of 16 bytes used
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    } );
  }

  // in bytes
  public createMapReadableBuffer( size: number ): GPUBuffer {
    return this.device.createBuffer( {
      size: size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    } );
  }

  // in bytes (takes 8 bytes per count)
  public createQueryBuffer( size: number ): GPUBuffer {
    return this.device.createBuffer( {
      size: size,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    } );
  }

  // (will take 8*capacity bytes)
  public createQuerySet( capacity: number ): GPUQuerySet {
    return this.device.createQuerySet( {
      type: 'timestamp',
      count: capacity
    } );
  }

  public getCanvasContext( canvas: HTMLCanvasElement, colorSpace: 'srgb' | 'display-p3' ): GPUCanvasContext {
    const context = canvas.getContext( 'webgpu' )!;

    if ( !context ) {
      throw new Error( 'Could not get a WebGPU context for the given Canvas' );
    }

    context.configure( {
      device: this.device,
      format: this.preferredCanvasFormat,
      colorSpace: colorSpace,
      usage: GPUTextureUsage.COPY_SRC |
             GPUTextureUsage.RENDER_ATTACHMENT |
             ( this.preferredCanvasFormat === this.preferredStorageFormat ? GPUTextureUsage.STORAGE_BINDING : 0 ),

      // Very important, otherwise we're opaque by default and alpha is ignored. We need to stack!!!
      alphaMode: 'premultiplied'
    } );
    return context;
  }

  public async executeSingle<T>(
    run: ( encoder: GPUCommandEncoder, bufferLogger: BufferLogger, createBuffer: ( size: number ) => GPUBuffer ) => Promise<T>
  ): Promise<T> {
    const bufferLogger = new BufferLogger( this );
    const encoder = this.device.createCommandEncoder( { label: 'the encoder' } );
    const buffersToCleanup: GPUBuffer[] = [];

    const promise = run( encoder, bufferLogger, size => {
      const buffer = this.createBuffer( size );
      buffersToCleanup.push( buffer );
      return buffer;
    } );

    const commandBuffer = encoder.finish();
    this.device.queue.submit( [ commandBuffer ] );
    await bufferLogger.complete();

    buffersToCleanup.forEach( buffer => buffer.destroy() );

    return promise;
  }

  public static async getDevice( providedOptions?: DeviceContextDeviceOptions ): Promise<GPUDevice | null> {

    const options = optionize<DeviceContextDeviceOptions>()( {
      maxLimits: false,
      timestampQuery: false,
      highPerformance: true
    }, providedOptions );

    let device: GPUDevice | null = null;

    try {
      const adapter = await navigator.gpu?.requestAdapter( {
        powerPreference: options.highPerformance ? 'high-performance' : 'low-power'
      } );

      if ( !adapter ) {
        return null;
      }

      const supportsBGRATextureStorage = adapter.features.has( 'bgra8unorm-storage' ) || false;

      const features: GPUFeatureName[] = supportsBGRATextureStorage ? [ 'bgra8unorm-storage' ] : [];

      if ( options.timestampQuery ) {
        if ( adapter.features.has( 'timestamp-query' ) ) {
          features.push( 'timestamp-query' );
        }
        else {
          throw new Error( 'timestamp-query feature not available' );
        }
      }

      const limits: Record<string, number> = {};
      if ( options.maxLimits ) {
        limitNames.forEach( name => {
          limits[ name ] = adapter.limits[ name ];
        } );
      }

      device = await adapter?.requestDevice( {
        requiredFeatures: features,
        requiredLimits: limits
      } ) || null;
    }
    catch( err ) {
      // For now, do nothing (WebGPU not enabled message perhaps?)
      console.log( err );
    }

    return device;
  }

  public dispose(): void {
    this.device.destroy();
  }

  public static async getMappedFloatArray( buffer: GPUBuffer ): Promise<Float32Array> {
    await buffer.mapAsync( GPUMapMode.READ );
    const resultArrayBuffer = buffer.getMappedRange();

    const outputArray = new Float32Array( resultArrayBuffer.byteLength / 4 );
    outputArray.set( new Float32Array( resultArrayBuffer ) );

    buffer.unmap();

    return outputArray;
  }

  public static async getMappedUintArray( buffer: GPUBuffer ): Promise<Uint32Array> {
    await buffer.mapAsync( GPUMapMode.READ );
    const resultArrayBuffer = buffer.getMappedRange();

    const outputArray = new Uint32Array( resultArrayBuffer.byteLength / 4 );
    outputArray.set( new Uint32Array( resultArrayBuffer ) );

    buffer.unmap();

    return outputArray;
  }

  public static async getMappedIntArray( buffer: GPUBuffer ): Promise<Int32Array> {
    await buffer.mapAsync( GPUMapMode.READ );
    const resultArrayBuffer = buffer.getMappedRange();

    const outputArray = new Int32Array( resultArrayBuffer.byteLength / 4 );
    outputArray.set( new Int32Array( resultArrayBuffer ) );

    buffer.unmap();

    return outputArray;
  }

  public static async getMappedByteArray( buffer: GPUBuffer ): Promise<Uint8Array> {
    await buffer.mapAsync( GPUMapMode.READ );
    const resultArrayBuffer = buffer.getMappedRange();

    const outputArray = new Uint8Array( resultArrayBuffer.byteLength );
    outputArray.set( new Uint8Array( resultArrayBuffer ) );

    buffer.unmap();

    return outputArray;
  }

  public static async getMappedArrayBuffer( buffer: GPUBuffer ): Promise<ArrayBuffer> {
    return ( await DeviceContext.getMappedByteArray( buffer ) ).buffer;
  }
}

alpenglow.register( 'DeviceContext', DeviceContext );
