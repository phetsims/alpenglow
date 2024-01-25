// Copyright 2024, University of Colorado Boulder

/**
 * Responsible for recording GPU commands globally, so we can play them back later.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';

export type PreferredCanvasFormat = 'bgra8unorm' | 'rgba8unorm';

let idCounter = 1;

export default class WebGPUAPI {

  public getAdapter( options?: GPURequestAdapterOptions ): Promise<GPUAdapter | null> {
    return navigator.gpu?.requestAdapter( options );
  }
  public getPreferredCanvasFormat(): PreferredCanvasFormat {
    const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat() as PreferredCanvasFormat;

    assert && assert( preferredCanvasFormat === 'bgra8unorm' || preferredCanvasFormat === 'rgba8unorm',
      'According to WebGPU documentation, this should only be bgra8unorm or rgba8unorm' );

    return preferredCanvasFormat;
  }

  public adapterHasFeature( adapter: GPUAdapter, featureName: string ): boolean {
    return adapter.features.has( featureName ) || false;
  }
  public async adapterRequestDevice( adapter: GPUAdapter, descriptor?: GPUDeviceDescriptor ): Promise<GPUDevice | null> {
    return await adapter.requestDevice( descriptor ) || null;
  }

  public deviceCreateBuffer( device: GPUDevice, descriptor: GPUBufferDescriptor ): GPUBuffer {
    return device.createBuffer( descriptor );
  }
  public deviceCreateQuerySet(
    device: GPUDevice,
    descriptor: GPUQuerySetDescriptor
  ): GPUQuerySet {
    return device.createQuerySet( descriptor );
  }
  public deviceCreateShaderModule(
    device: GPUDevice,
    descriptor: GPUShaderModuleDescriptor
  ): GPUShaderModule {
    return device.createShaderModule( descriptor );
  }
  public deviceCreateComputePipeline(
    device: GPUDevice,
    descriptor: GPUComputePipelineDescriptor
  ): GPUComputePipeline {
    return device.createComputePipeline( descriptor );
  }
  public deviceCreateComputePipelineAsync(
    device: GPUDevice,
    descriptor: GPUComputePipelineDescriptor
  ): Promise<GPUComputePipeline> {
    return device.createComputePipelineAsync( descriptor );
  }
  public deviceCreateBindGroup(
    device: GPUDevice,
    descriptor: GPUBindGroupDescriptor
  ): GPUBindGroup {
    return device.createBindGroup( descriptor );
  }
  public deviceCreateBindGroupLayout(
    device: GPUDevice,
    descriptor: GPUBindGroupLayoutDescriptor
  ): GPUBindGroupLayout {
    return device.createBindGroupLayout( descriptor );
  }
  public deviceCreatePipelineLayout(
    device: GPUDevice,
    descriptor: GPUPipelineLayoutDescriptor
  ): GPUPipelineLayout {
    return device.createPipelineLayout( descriptor );
  }
  public deviceCreateCommandEncoder(
    device: GPUDevice,
    descriptor?: GPUCommandEncoderDescriptor
  ): GPUCommandEncoder {
    return device.createCommandEncoder( descriptor );
  }
  public deviceWriteBuffer(
    device: GPUDevice,
    buffer: GPUBuffer,
    bufferOffset: number,
    data:
      | BufferSource
      | SharedArrayBuffer,
    dataOffset?: number,
    size?: number
  ): void {
    device.queue.writeBuffer( buffer, bufferOffset, data, dataOffset, size );
  }
  public deviceQueueSubmit(
    device: GPUDevice,
    commandBuffers: Iterable<GPUCommandBuffer>
  ): void {
    device.queue.submit( commandBuffers );
  }
  public deviceHasFeature( device: GPUDevice, featureName: string ): boolean {
    return device.features.has( featureName ) || false;
  }
  public deviceDestroy( device: GPUDevice ): void {
    device.destroy();
  }

  public bufferMapAsync(
    buffer: GPUBuffer,
    mode: GPUMapModeFlags,
    offset?: number,
    size?: number
  ): Promise<void> {
    return buffer.mapAsync( mode, offset, size );
  }
  public bufferUnmap( buffer: GPUBuffer ): void {
    buffer.unmap();
  }
  public bufferGetMappedRange( buffer: GPUBuffer, offset?: number, size?: number ): ArrayBuffer {
    return buffer.getMappedRange( offset, size );
  }
  public bufferDestroy( buffer: GPUBuffer ): void {
    buffer.destroy();
  }

  public encoderBeginRenderPass(
    encoder: GPUCommandEncoder,
    descriptor: GPURenderPassDescriptor
  ): GPURenderPassEncoder {
    return encoder.beginRenderPass( descriptor );
  }
  public encoderBeginComputePass(
    encoder: GPUCommandEncoder,
    descriptor: GPUComputePassDescriptor
  ): GPUComputePassEncoder {
    return encoder.beginComputePass( descriptor );
  }
  public encoderCopyBufferToBuffer(
    encoder: GPUCommandEncoder,
    source: GPUBuffer,
    sourceOffset: number,
    destination: GPUBuffer,
    destinationOffset: number,
    size: number
  ): void {
    encoder.copyBufferToBuffer( source, sourceOffset, destination, destinationOffset, size );
  }
  public encoderCopyBufferToTexture(
    encoder: GPUCommandEncoder,
    source: GPUImageCopyBuffer,
    destination: GPUImageCopyTexture,
    copySize: GPUExtent3DStrict
  ): void {
    encoder.copyBufferToTexture( source, destination, copySize );
  }
  public encoderCopyTextureToBuffer(
    encoder: GPUCommandEncoder,
    source: GPUImageCopyTexture,
    destination: GPUImageCopyBuffer,
    copySize: GPUExtent3DStrict
  ): void {
    encoder.copyTextureToBuffer( source, destination, copySize );
  }
  public encoderCopyTextureToTexture(
    encoder: GPUCommandEncoder,
    source: GPUImageCopyTexture,
    destination: GPUImageCopyTexture,
    copySize: GPUExtent3DStrict
  ): void {
    encoder.copyTextureToTexture( source, destination, copySize );
  }
  public encoderClearBuffer(
    encoder: GPUCommandEncoder,
    buffer: GPUBuffer,
    offset?: number,
    size?: number
  ): void {
    encoder.clearBuffer( buffer, offset, size );
  }
  public encoderResolveQuerySet(
    encoder: GPUCommandEncoder,
    querySet: GPUQuerySet,
    firstQuery: number,
    queryCount: number,
    destination: GPUBuffer,
    destinationOffset: number
  ): void {
    encoder.resolveQuerySet( querySet, firstQuery, queryCount, destination, destinationOffset );
  }
  public encoderFinish(
    encoder: GPUCommandEncoder,
    descriptor?: GPUCommandBufferDescriptor
  ): GPUCommandBuffer {
    return encoder.finish( descriptor );
  }

  public computePassEncoderSetPipeline(
    computePassEncoder: GPUComputePassEncoder,
    pipeline: GPUComputePipeline
  ): void {
    computePassEncoder.setPipeline( pipeline );
  }
  public computePassEncoderDispatchWorkgroups(
    computePassEncoder: GPUComputePassEncoder,
    x: number,
    y?: number,
    z?: number
  ): void {
    computePassEncoder.dispatchWorkgroups( x, y, z );
  }
  public computePassEncoderDispatchWorkgroupsIndirect(
    computePassEncoder: GPUComputePassEncoder,
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): void {
    computePassEncoder.dispatchWorkgroupsIndirect( indirectBuffer, indirectOffset );
  }
  public passEncoderSetBindGroup(
    passEncoder: GPURenderPassEncoder | GPUComputePassEncoder,
    index: number,
    bindGroup: GPUBindGroup | null,
    dynamicOffsets?: Iterable<number>
  ): void {
    passEncoder.setBindGroup( index, bindGroup, dynamicOffsets );
  }
  // TODO: consider adding the other approach to dynamic offsets?
  public computePassEncoderEnd( computePassEncoder: GPUComputePassEncoder ): void {
    computePassEncoder.end();
  }

  public querySetDestroy( querySet: GPUQuerySet ): void {
    querySet.destroy();
  }

  // TODO: tags and sections

  private readonly commands: string[] = [];
  private readonly nameMap = new WeakMap<IntentionalAny, string>();

  // Can adjust this to turn it on
  public active = false;

  public register( object: IntentionalAny, namePrefix: string ): void {
    if ( this.active ) {
      const id = idCounter++;
      this.nameMap.set( object, namePrefix + id );
    }
  }

  public command( object: IntentionalAny, name: string, ...args: string[] ): void {
    if ( this.active ) {
      const command = `${this.getName( object )}.${name}( ${args.join( ', ' )} );`;
      this.commands.push( command );
    }
  }

  public writeBuffer( queue: GPUQueue, buffer: GPUBuffer, bufferOffset: number, data: ArrayBufferLike, ...args: number[] ): void {
    this.command( queue, 'writeBuffer', this.getName( buffer ), `${bufferOffset}`, WebGPUAPI.arrayBufferLikeString( data ), ...args.map( arg => `${arg}` ) );
  }

  public comment( comment: string ): void {
    this.commands.push( `// ${comment}` );
  }

  public getName( object: IntentionalAny ): string {
    if ( this.active ) {
      const name = this.nameMap.get( object );

      assert && assert( name, 'object not registered' );
      return name!;
    }
    else {
      return '';
    }
  }

  public reset(): void {
    if ( this.active ) {
      this.commands.length = 0;
    }
  }

  public static arrayBufferLikeString( data: ArrayBufferLike ): string {
    return `new Uint8Array( [ ${new Uint8Array( data ).join( ', ' )} ] ).buffer`;
  }

  public static bufferDescriptorString( descriptor: GPUBufferDescriptor ): string {
    const usageNames: string[] = [];

    if ( descriptor.usage & GPUBufferUsage.MAP_READ ) {
      usageNames.push( 'MAP_READ' );
    }
    if ( descriptor.usage & GPUBufferUsage.MAP_WRITE ) {
      usageNames.push( 'MAP_WRITE' );
    }
    if ( descriptor.usage & GPUBufferUsage.COPY_SRC ) {
      usageNames.push( 'COPY_SRC' );
    }
    if ( descriptor.usage & GPUBufferUsage.COPY_DST ) {
      usageNames.push( 'COPY_DST' );
    }
    if ( descriptor.usage & GPUBufferUsage.INDEX ) {
      usageNames.push( 'INDEX' );
    }
    if ( descriptor.usage & GPUBufferUsage.VERTEX ) {
      usageNames.push( 'VERTEX' );
    }
    if ( descriptor.usage & GPUBufferUsage.UNIFORM ) {
      usageNames.push( 'UNIFORM' );
    }
    if ( descriptor.usage & GPUBufferUsage.STORAGE ) {
      usageNames.push( 'STORAGE' );
    }
    if ( descriptor.usage & GPUBufferUsage.INDIRECT ) {
      usageNames.push( 'INDIRECT' );
    }
    if ( descriptor.usage & GPUBufferUsage.QUERY_RESOLVE ) {
      usageNames.push( 'QUERY_RESOLVE' );
    }

    const usage = usageNames.length ? usageNames.map( name => `GPUBufferUsage.${name}` ).join( ' | ' ) : '0';

    return `{ size: ${descriptor.size}, usage: ${usage}${descriptor.mappedAtCreation !== undefined ? `, mappedAtCreation: ${descriptor.mappedAtCreation}` : ''} }`;
  }
}
alpenglow.register( 'WebGPUAPI', WebGPUAPI );

export const webgpu = new WebGPUAPI();
alpenglow.register( 'webgpu', webgpu );

