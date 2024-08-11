// Copyright 2023-2024, University of Colorado Boulder

/**
 * Handle resources and settings connected to a GPUDevice
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ByteEncoder, PreferredCanvasFormat, webgpu } from '../../imports.js';
import TinyEmitter from '../../../../axon/js/TinyEmitter.js';
import optionize from '../../../../phet-core/js/optionize.js';

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

    this.preferredCanvasFormat = webgpu.getPreferredCanvasFormat();

    this.preferredStorageFormat =
      ( this.preferredCanvasFormat === 'bgra8unorm' && webgpu.deviceHasFeature( device, 'bgra8unorm-storage' ) )
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
  public createBuffer( size: number, flags = 0 ): GPUBuffer {
    assert && assert( size > 0 );

    return webgpu.deviceCreateBuffer( this.device, {
      size: size,
      usage: flags === 0 ? ( GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE ) : flags
    } );
  }

  public createDataBuffer( data: ArrayBufferView ): GPUBuffer {
    const buffer = this.createBuffer( data.byteLength );
    webgpu.deviceWriteBuffer( this.device, buffer, 0, data.buffer );
    return buffer;
  }

  public createU32Buffer( data: number[] ): GPUBuffer {
    return this.createDataBuffer( new Uint32Array( data ) );
  }

  public createI32Buffer( data: number[] ): GPUBuffer {
    return this.createDataBuffer( new Int32Array( data ) );
  }

  public createF32Buffer( data: number[] ): GPUBuffer {
    return this.createDataBuffer( new Float32Array( data ) );
  }

  public createByteEncoderBuffer( encoder: ByteEncoder ): GPUBuffer {
    const buffer = this.createBuffer( encoder.byteLength );
    webgpu.deviceWriteBuffer( this.device, buffer, 0, encoder.fullArrayBuffer, 0, encoder.byteLength );
    return buffer;
  }

  // in bytes
  public createMapReadableBuffer( size: number ): GPUBuffer {
    return this.createBuffer( size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST );
  }

  // in bytes (takes 8 bytes per count)
  public createQueryBuffer( size: number ): GPUBuffer {
    return this.createBuffer( size, GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST );
  }

  // (will take 8*capacity bytes)
  public createQuerySet( capacity: number ): GPUQuerySet {
    return webgpu.deviceCreateQuerySet( this.device, {
      type: 'timestamp',
      count: capacity
    } );
  }

  public getCanvasContext( canvas: HTMLCanvasElement, colorSpace: 'srgb' | 'display-p3' ): GPUCanvasContext {
    const context = canvas.getContext( 'webgpu' )!;

    if ( !context ) {
      throw new Error( 'Could not get a WebGPU context for the given Canvas' );
    }

    // TODO: how will we log this type of thing?
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

  public static async getDevice( providedOptions?: DeviceContextDeviceOptions ): Promise<GPUDevice | null> {

    const options = optionize<DeviceContextDeviceOptions>()( {
      maxLimits: false,
      timestampQuery: false,
      highPerformance: true
    }, providedOptions );

    let device: GPUDevice | null = null;

    try {
      const adapter = await webgpu.getAdapter( {
        powerPreference: options.highPerformance ? 'high-performance' : 'low-power'
      } );

      if ( !adapter ) {
        return null;
      }

      const supportsBGRATextureStorage = webgpu.adapterHasFeature( adapter, 'bgra8unorm-storage' );

      const features: GPUFeatureName[] = supportsBGRATextureStorage ? [ 'bgra8unorm-storage' ] : [];

      if ( options.timestampQuery ) {
        if ( webgpu.adapterHasFeature( adapter, 'timestamp-query' ) ) {
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

      const requestDeviceOptions: GPUDeviceDescriptor = {
        requiredFeatures: features,
        requiredLimits: limits
      };
      device = await webgpu.adapterRequestDevice( adapter, requestDeviceOptions );
    }
    catch( err ) {
      // For now, do nothing (WebGPU not enabled message perhaps?)
      console.log( err );
    }

    return device;
  }

  public dispose(): void {
    webgpu.deviceDestroy( this.device );
  }

  // TODO: reduce code duplication around here
  public static async getMappedFloatArray( buffer: GPUBuffer ): Promise<Float32Array> {
    await webgpu.bufferMapAsync( buffer, GPUMapMode.READ );
    const resultArrayBuffer = webgpu.bufferGetMappedRange( buffer );

    const outputArray = new Float32Array( resultArrayBuffer.byteLength / 4 );
    outputArray.set( new Float32Array( resultArrayBuffer ) );

    webgpu.bufferUnmap( buffer );

    return outputArray;
  }

  public static async getMappedUintArray( buffer: GPUBuffer ): Promise<Uint32Array> {
    await webgpu.bufferMapAsync( buffer, GPUMapMode.READ );
    const resultArrayBuffer = webgpu.bufferGetMappedRange( buffer );

    const outputArray = new Uint32Array( resultArrayBuffer.byteLength / 4 );
    outputArray.set( new Uint32Array( resultArrayBuffer ) );

    webgpu.bufferUnmap( buffer );

    return outputArray;
  }

  public static async getMappedIntArray( buffer: GPUBuffer ): Promise<Int32Array> {
    await webgpu.bufferMapAsync( buffer, GPUMapMode.READ );
    const resultArrayBuffer = webgpu.bufferGetMappedRange( buffer );

    const outputArray = new Int32Array( resultArrayBuffer.byteLength / 4 );
    outputArray.set( new Int32Array( resultArrayBuffer ) );

    webgpu.bufferUnmap( buffer );

    return outputArray;
  }

  public static async getMappedByteArray( buffer: GPUBuffer ): Promise<Uint8Array> {
    await webgpu.bufferMapAsync( buffer, GPUMapMode.READ );
    const resultArrayBuffer = webgpu.bufferGetMappedRange( buffer );

    const outputArray = new Uint8Array( resultArrayBuffer.byteLength );
    outputArray.set( new Uint8Array( resultArrayBuffer ) );

    webgpu.bufferUnmap( buffer );

    return outputArray;
  }

  public static async getMappedArrayBuffer( buffer: GPUBuffer ): Promise<ArrayBuffer> {
    return ( await DeviceContext.getMappedByteArray( buffer ) ).buffer;
  }
}

alpenglow.register( 'DeviceContext', DeviceContext );