// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroup, ComputePipeline, webgpu } from '../../imports.js';

let globalId = 1;

export default class ComputePass {

  public readonly id = globalId++;

  public readonly computePassEncoder: GPUComputePassEncoder;

  private currentPipeline: ComputePipeline | null = null;
  private currentBindGroups = new Map<number, BindGroup>();

  public constructor(
    encoder: GPUCommandEncoder,
    computePassDescriptor: GPUComputePassDescriptor
  ) {
    this.computePassEncoder = webgpu.encoderBeginComputePass( encoder, computePassDescriptor );
  }

  private prepare(
    computePipeline: ComputePipeline,
    bindGroups: BindGroup[]
  ): void {
    if ( this.currentPipeline !== computePipeline ) {
      webgpu.computePassEncoderSetPipeline( this.computePassEncoder, computePipeline.pipeline );
      this.currentPipeline = computePipeline;
    }

    for ( let i = 0; i < bindGroups.length; i++ ) {
      const bindGroup = bindGroups[ i ];
      const currentBindGroup = this.currentBindGroups.get( i );

      if ( currentBindGroup !== bindGroup ) {
        webgpu.passEncoderSetBindGroup( this.computePassEncoder, i, bindGroup.bindGroup );
        this.currentBindGroups.set( i, bindGroup );
      }
    }
  }

  private attemptLogBarrier(
    computePipeline: ComputePipeline
  ): void {
    if ( computePipeline.logBarrierPipeline ) {
      this.currentPipeline = null;
      webgpu.computePassEncoderSetPipeline( this.computePassEncoder, computePipeline.logBarrierPipeline );
      webgpu.computePassEncoderDispatchWorkgroups( this.computePassEncoder, 1, 1, 1 );
    }
  }

  public dispatchPipeline(
    computePipeline: ComputePipeline,
    bindGroups: BindGroup[],
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1
  ): this {
    this.prepare( computePipeline, bindGroups );

    webgpu.computePassEncoderDispatchWorkgroups( this.computePassEncoder, dispatchX, dispatchY, dispatchZ );

    this.attemptLogBarrier( computePipeline );

    // allow chaining
    return this;
  }

  public dispatchPipelineIndirect(
    computePipeline: ComputePipeline,
    bindGroups: BindGroup[],
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): this {
    this.prepare( computePipeline, bindGroups );

    webgpu.computePassEncoderDispatchWorkgroupsIndirect( this.computePassEncoder, indirectBuffer, indirectOffset );

    this.attemptLogBarrier( computePipeline );

    // allow chaining
    return this;
  }

  public end(): void {
    webgpu.computePassEncoderEnd( this.computePassEncoder );
  }
}
alpenglow.register( 'ComputePass', ComputePass );