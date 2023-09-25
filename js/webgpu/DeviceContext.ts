// Copyright 2023, University of Colorado Boulder

/**
 * Handle resources and settings connected to a GPUDevice
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';
import TinyEmitter from '../../../axon/js/TinyEmitter.js';

export type PreferredCanvasFormat = 'bgra8unorm' | 'rgba8unorm';

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
  }

  public createBuffer( size: number ): GPUBuffer {
    return this.device.createBuffer( {
      size: Math.max( size, 16 ), // Min of 16 bytes used
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    } );
  }

  public getCanvasContext( canvas: HTMLCanvasElement ): GPUCanvasContext {
    const context = canvas.getContext( 'webgpu' )!;

    if ( !context ) {
      throw new Error( 'Could not get a WebGPU context for the given Canvas' );
    }

    context.configure( {
      device: this.device,
      format: this.preferredCanvasFormat,
      usage: GPUTextureUsage.COPY_SRC |
             GPUTextureUsage.RENDER_ATTACHMENT |
             ( this.preferredCanvasFormat === this.preferredStorageFormat ? GPUTextureUsage.STORAGE_BINDING : 0 ),

      // Very important, otherwise we're opaque by default and alpha is ignored. We need to stack!!!
      alphaMode: 'premultiplied'
    } );
    return context;
  }

  public static async getDevice(): Promise<GPUDevice | null> {
    let device: GPUDevice | null = null;

    try {
      const adapter = await navigator.gpu?.requestAdapter( {
        powerPreference: 'high-performance'
      } );

      const supportsBGRATextureStorage = adapter?.features.has( 'bgra8unorm-storage' ) || false;

      device = await adapter?.requestDevice( {
        requiredFeatures: supportsBGRATextureStorage ? [ 'bgra8unorm-storage' ] : []
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
}

alpenglow.register( 'DeviceContext', DeviceContext );
