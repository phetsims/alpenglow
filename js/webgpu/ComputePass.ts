// Copyright 2023, University of Colorado Boulder

/**
 * Handles minimizing changed data in GPUComputePassEncoder
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroup, ComputePipeline } from '../imports.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';

export default class ComputePass {

  public readonly computePassEncoder: GPUComputePassEncoder;

  private currentPipeline: ComputePipeline<IntentionalAny> | null = null;
  private currentBindGroups = new Map<number, BindGroup<IntentionalAny>>();

  public constructor(
    encoder: GPUCommandEncoder,
    computePassDescriptor: GPUComputePassDescriptor
  ) {
    this.computePassEncoder = encoder.beginComputePass( computePassDescriptor );
  }

  private prepare(
    computePipeline: ComputePipeline<IntentionalAny>,
    bindGroups: BindGroup<IntentionalAny>[]
  ): void {
    if ( this.currentPipeline !== computePipeline ) {
      this.computePassEncoder.setPipeline( computePipeline.pipeline );
      this.currentPipeline = computePipeline;
    }

    for ( let i = 0; i < bindGroups.length; i++ ) {
      const bindGroup = bindGroups[ i ];
      const currentBindGroup = this.currentBindGroups.get( i );

      if ( currentBindGroup !== bindGroup ) {
        this.computePassEncoder.setBindGroup( i, bindGroup.bindGroup );
        this.currentBindGroups.set( i, bindGroup );
      }
    }
  }

  private attemptLogBarrier(
    computePipeline: ComputePipeline<IntentionalAny>
  ): void {
    if ( computePipeline.logBarrierPipeline ) {
      this.currentPipeline = null;
      this.computePassEncoder.setPipeline( computePipeline.logBarrierPipeline );
      this.computePassEncoder.dispatchWorkgroups( 1, 1, 1 );
    }
  }

  public dispatchPipeline(
    computePipeline: ComputePipeline<IntentionalAny>,
    bindGroups: BindGroup<IntentionalAny>[],
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1
  ): this {
    this.prepare( computePipeline, bindGroups );

    this.computePassEncoder.dispatchWorkgroups( dispatchX, dispatchY, dispatchZ );

    this.attemptLogBarrier( computePipeline );

    // allow chaining
    return this;
  }

  public dispatchPipelineIndirect(
    computePipeline: ComputePipeline<IntentionalAny>,
    bindGroups: BindGroup<IntentionalAny>[],
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): this {
    this.prepare( computePipeline, bindGroups );

    this.computePassEncoder.dispatchWorkgroupsIndirect( indirectBuffer, indirectOffset );

    this.attemptLogBarrier( computePipeline );

    // allow chaining
    return this;
  }

  public end(): void {
    this.computePassEncoder.end();
  }
}

alpenglow.register( 'ComputePass', ComputePass );
