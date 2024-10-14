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
    const querySet = device.createQuerySet( descriptor );

    if ( this.recorder ) {
      this.recorder.recordDeviceCreateQuerySet( querySet, device, descriptor );
    }

    return querySet;
  }
  public deviceCreateBindGroupLayout(
    device: GPUDevice,
    descriptor: GPUBindGroupLayoutDescriptor
  ): GPUBindGroupLayout {
    const bindGroupLayout = device.createBindGroupLayout( descriptor );

    if ( this.recorder ) {
      this.recorder.recordDeviceCreateBindGroupLayout( bindGroupLayout, device, descriptor );
    }

    return bindGroupLayout;
  }
  public deviceCreatePipelineLayout(
    device: GPUDevice,
    descriptor: GPUPipelineLayoutDescriptor
  ): GPUPipelineLayout {
    const pipelineLayout = device.createPipelineLayout( descriptor );

    if ( this.recorder ) {
      this.recorder.recordDeviceCreatePipelineLayout( pipelineLayout, device, descriptor );
    }

    return pipelineLayout;
  }
  public deviceCreateShaderModule(
    device: GPUDevice,
    descriptor: GPUShaderModuleDescriptor
  ): GPUShaderModule {
    const shaderModule = device.createShaderModule( descriptor );

    if ( this.recorder ) {
      this.recorder.recordDeviceCreateShaderModule( shaderModule, device, descriptor );
    }

    return shaderModule;
  }
  public deviceCreateComputePipeline(
    device: GPUDevice,
    descriptor: GPUComputePipelineDescriptor
  ): GPUComputePipeline {
    const computePipeline = device.createComputePipeline( descriptor );

    if ( this.recorder ) {
      this.recorder.recordDeviceCreateComputePipeline( computePipeline, device, descriptor, false );
    }

    return computePipeline;
  }
  public async deviceCreateComputePipelineAsync(
    device: GPUDevice,
    descriptor: GPUComputePipelineDescriptor
  ): Promise<GPUComputePipeline> {
    const computePipeline = await device.createComputePipelineAsync( descriptor );

    if ( this.recorder ) {
      this.recorder.recordDeviceCreateComputePipeline( computePipeline, device, descriptor, true );
    }

    return computePipeline;
  }
  public deviceCreateBindGroup(
    device: GPUDevice,
    descriptor: GPUBindGroupDescriptor
  ): GPUBindGroup {
    const bindGroup = device.createBindGroup( descriptor );

    if ( this.recorder ) {
      this.recorder.recordDeviceCreateBindGroup( bindGroup, device, descriptor );
    }

    return bindGroup;
  }

  public deviceCreateCommandEncoder(
    device: GPUDevice,
    descriptor?: GPUCommandEncoderDescriptor
  ): GPUCommandEncoder {
    const commandEncoder = device.createCommandEncoder( descriptor );

    if ( this.recorder ) {
      this.recorder.recordDeviceCreateCommandEncoder( commandEncoder, device, descriptor );
    }

    return commandEncoder;
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

    if ( this.recorder ) {
      this.recorder.recordDeviceWriteBuffer( device, buffer, bufferOffset, data, dataOffset, size );
    }
  }
  public deviceQueueSubmit(
    device: GPUDevice,
    commandBuffers: Iterable<GPUCommandBuffer>
  ): void {
    device.queue.submit( commandBuffers );

    if ( this.recorder ) {
      this.recorder.recordDeviceQueueSubmit( device, commandBuffers );
    }
  }
  public deviceHasFeature( device: GPUDevice, featureName: string ): boolean {
    return device.features.has( featureName ) || false;
  }
  public deviceDestroy( device: GPUDevice ): void {
    device.destroy();

    if ( this.recorder ) {
      this.recorder.recordDeviceDestroy( device );
    }
  }

  public bufferMapAsync(
    buffer: GPUBuffer,
    mode: GPUMapModeFlags,
    offset?: number,
    size?: number
  ): Promise<void> {
    if ( this.recorder ) {
      this.recorder.recordBufferMapAsync( buffer, mode, offset, size );
    }
    return buffer.mapAsync( mode, offset, size );
  }
  public bufferUnmap( buffer: GPUBuffer ): void {
    buffer.unmap();

    if ( this.recorder ) {
      this.recorder.recordBufferUnmap( buffer );
    }
  }
  public bufferGetMappedRange( buffer: GPUBuffer, offset?: number, size?: number ): ArrayBuffer {
    return buffer.getMappedRange( offset, size );
  }
  public bufferDestroy( buffer: GPUBuffer ): void {
    buffer.destroy();

    if ( this.recorder ) {
      this.recorder.recordBufferDestroy( buffer );
    }
  }

  public encoderBeginRenderPass(
    encoder: GPUCommandEncoder,
    descriptor: GPURenderPassDescriptor
  ): GPURenderPassEncoder {
    const renderPassEncoder = encoder.beginRenderPass( descriptor );

    if ( this.recorder ) {
      this.recorder.recordEncoderBeginRenderPass( renderPassEncoder, encoder, descriptor );
    }

    return renderPassEncoder;
  }
  public encoderBeginComputePass(
    encoder: GPUCommandEncoder,
    descriptor?: GPUComputePassDescriptor
  ): GPUComputePassEncoder {
    const computePassEncoder = encoder.beginComputePass( descriptor );

    if ( this.recorder ) {
      this.recorder.recordEncoderBeginComputePass( computePassEncoder, encoder, descriptor );
    }

    return computePassEncoder;
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

    if ( this.recorder ) {
      this.recorder.recordEncoderCopyBufferToBuffer( encoder, source, sourceOffset, destination, destinationOffset, size );
    }
  }
  public encoderCopyBufferToTexture(
    encoder: GPUCommandEncoder,
    source: GPUImageCopyBuffer,
    destination: GPUImageCopyTexture,
    copySize: GPUExtent3DStrict
  ): void {
    encoder.copyBufferToTexture( source, destination, copySize );

    if ( this.recorder ) {
      this.recorder.recordEncoderCopyBufferToTexture( encoder, source, destination, copySize );
    }
  }
  public encoderCopyTextureToBuffer(
    encoder: GPUCommandEncoder,
    source: GPUImageCopyTexture,
    destination: GPUImageCopyBuffer,
    copySize: GPUExtent3DStrict
  ): void {
    encoder.copyTextureToBuffer( source, destination, copySize );

    if ( this.recorder ) {
      this.recorder.recordEncoderCopyTextureToBuffer( encoder, source, destination, copySize );
    }
  }
  public encoderCopyTextureToTexture(
    encoder: GPUCommandEncoder,
    source: GPUImageCopyTexture,
    destination: GPUImageCopyTexture,
    copySize: GPUExtent3DStrict
  ): void {
    encoder.copyTextureToTexture( source, destination, copySize );

    if ( this.recorder ) {
      this.recorder.recordEncoderCopyTextureToTexture( encoder, source, destination, copySize );
    }
  }
  public encoderClearBuffer(
    encoder: GPUCommandEncoder,
    buffer: GPUBuffer,
    offset?: number,
    size?: number
  ): void {
    encoder.clearBuffer( buffer, offset, size );

    if ( this.recorder ) {
      this.recorder.recordEncoderClearBuffer( encoder, buffer, offset, size );
    }
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

    if ( this.recorder ) {
      this.recorder.recordEncoderResolveQuerySet( encoder, querySet, firstQuery, queryCount, destination, destinationOffset );
    }
  }
  public encoderFinish(
    encoder: GPUCommandEncoder,
    descriptor?: GPUCommandBufferDescriptor
  ): GPUCommandBuffer {
    const commandBuffer = encoder.finish( descriptor );

    if ( this.recorder ) {
      this.recorder.recordEncoderFinish( commandBuffer, encoder, descriptor );
    }

    return commandBuffer;
  }

  public computePassEncoderSetPipeline(
    computePassEncoder: GPUComputePassEncoder,
    pipeline: GPUComputePipeline
  ): void {
    computePassEncoder.setPipeline( pipeline );

    if ( this.recorder ) {
      this.recorder.recordComputePassEncoderSetPipeline( computePassEncoder, pipeline );
    }
  }
  public computePassEncoderDispatchWorkgroups(
    computePassEncoder: GPUComputePassEncoder,
    x: number,
    y?: number,
    z?: number
  ): void {
    computePassEncoder.dispatchWorkgroups( x, y, z );

    if ( this.recorder ) {
      this.recorder.recordComputePassEncoderDispatchWorkgroups( computePassEncoder, x, y, z );
    }
  }
  public computePassEncoderDispatchWorkgroupsIndirect(
    computePassEncoder: GPUComputePassEncoder,
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): void {
    computePassEncoder.dispatchWorkgroupsIndirect( indirectBuffer, indirectOffset );

    if ( this.recorder ) {
      this.recorder.recordComputePassEncoderDispatchWorkgroupsIndirect( computePassEncoder, indirectBuffer, indirectOffset );
    }
  }
  // TODO: consider adding the other approach to dynamic offsets?
  public passEncoderSetBindGroup(
    passEncoder: GPURenderPassEncoder | GPUComputePassEncoder,
    index: number,
    bindGroup: GPUBindGroup | null,
    dynamicOffsets?: Iterable<number>
  ): void {
    passEncoder.setBindGroup( index, bindGroup, dynamicOffsets );

    if ( this.recorder ) {
      this.recorder.recordPassEncoderSetBindGroup( passEncoder, index, bindGroup, dynamicOffsets );
    }
  }
  public computePassEncoderEnd( computePassEncoder: GPUComputePassEncoder ): void {
    computePassEncoder.end();

    if ( this.recorder ) {
      this.recorder.recordComputePassEncoderEnd( computePassEncoder );
    }
  }

  public querySetDestroy( querySet: GPUQuerySet ): void {
    querySet.destroy();

    if ( this.recorder ) {
      this.recorder.recordQuerySetDestroy( querySet );
    }
  }
}
alpenglow.register( 'WebGPUAPI', WebGPUAPI );

export const webgpu = new WebGPUAPI();
alpenglow.register( 'webgpu', webgpu );