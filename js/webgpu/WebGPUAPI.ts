// Copyright 2024, University of Colorado Boulder

/**
 * WebGPU commands should be run through here, so we can record them for later playback (and possibly other reasons).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, WebGPURecorder } from '../imports.js';
import { WebGPUCommandList } from './WebGPURecorder.js';

export type PreferredCanvasFormat = 'bgra8unorm' | 'rgba8unorm';

export default class WebGPUAPI {

  public recorder: WebGPURecorder | null = null;

  public enableRecording(): void {
    this.recorder = this.recorder || new WebGPURecorder();
  }

  public startRecording(): WebGPUCommandList {
    this.enableRecording();

    assert && assert( this.recorder );
    return this.recorder!.start();
  }

  public stopRecording( commandList: WebGPUCommandList ): void {
    assert && assert( this.recorder );
    this.recorder!.stop( commandList );
  }

  public async getAdapter(
    options?: GPURequestAdapterOptions
  ): Promise<GPUAdapter | null> {
    const adapter = await navigator.gpu?.requestAdapter( options );

    if ( this.recorder ) {
      this.recorder.recordGetAdapter( adapter, options );
    }

    return adapter;
  }
  public getPreferredCanvasFormat(): PreferredCanvasFormat {
    const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat() as PreferredCanvasFormat;

    assert && assert( preferredCanvasFormat === 'bgra8unorm' || preferredCanvasFormat === 'rgba8unorm',
      'According to WebGPU documentation, this should only be bgra8unorm or rgba8unorm' );

    return preferredCanvasFormat;
  }

  public adapterHasFeature(
    adapter: GPUAdapter,
    featureName: string
  ): boolean {
    return adapter.features.has( featureName ) || false;
  }
  public async adapterRequestDevice(
    adapter: GPUAdapter,
    descriptor?: GPUDeviceDescriptor
  ): Promise<GPUDevice | null> {
    const device = await adapter.requestDevice( descriptor ) || null;

    if ( this.recorder && device ) {
      this.recorder.recordAdapterRequestDevice( device, adapter, descriptor );
    }

    return device;
  }

  public deviceCreateBuffer(
    device: GPUDevice,
    descriptor: GPUBufferDescriptor
  ): GPUBuffer {
    const buffer = device.createBuffer( descriptor );

    if ( this.recorder ) {
      this.recorder.recordDeviceCreateBuffer( buffer, device, descriptor );
    }

    return buffer;
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
}
alpenglow.register( 'WebGPUAPI', WebGPUAPI );

export const webgpu = new WebGPUAPI();
alpenglow.register( 'webgpu', webgpu );

