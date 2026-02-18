// Copyright 2023-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';
import type { ComputePass } from './ComputePass.js';
import type { Executor } from './Executor.js';
import type { PipelineBlueprint } from './PipelineBlueprint.js';
import type { ComputePipeline } from './ComputePipeline.js';
import type { BindGroupLayout } from './BindGroupLayout.js';
import type { BindGroup } from './BindGroup.js';
import type { ResourceSlot } from './ResourceSlot.js';
import type { Resource } from './Resource.js';
import type { BufferSlot } from './BufferSlot.js';
import { TypedBuffer } from './TypedBuffer.js';

export class ExecutionContext {

  private computePass: ComputePass | null = null;

  // TODO: We might use one compute pass, we might split each into one
  public constructor(
    public readonly executor: Executor,

    // TODO: consider just referencing the Procedure
    public readonly computePipelineMap: Map<PipelineBlueprint, ComputePipeline>,
    public readonly bindGroupMap: Map<BindGroupLayout, BindGroup>,
    public readonly resourceMap: Map<ResourceSlot, Resource>,
    public readonly separateComputePasses: boolean
  ) {}

  public dispatch(
    pipelineBlueprint: PipelineBlueprint,
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1
  ): void {
    this.ensureComputePass( pipelineBlueprint.name );

    const computePipeline = this.computePipelineMap.get( pipelineBlueprint )!;
    assert && assert( computePipeline, 'Missing compute pipeline' );

    this.computePass!.dispatchPipeline( computePipeline, this.getBindGroups( computePipeline ), dispatchX, dispatchY, dispatchZ );

    if ( this.separateComputePasses ) {
      this.releaseComputePass();
    }
  }

  public dispatchIndirect(
    pipelineBlueprint: PipelineBlueprint,
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): void {
    this.ensureComputePass( pipelineBlueprint.name );

    const computePipeline = this.computePipelineMap.get( pipelineBlueprint )!;
    assert && assert( computePipeline, 'Missing compute pipeline' );

    this.computePass!.dispatchPipelineIndirect( computePipeline, this.getBindGroups( computePipeline ), indirectBuffer, indirectOffset );

    if ( this.separateComputePasses ) {
      this.releaseComputePass();
    }
  }

  // TODO: see if we can get the bind groups to be optimized?
  public getEncoderForCustomRender(): GPUCommandEncoder {
    this.releaseComputePass();

    return this.executor.encoder;
  }

  public setTypedBufferValue<T>( bufferSlot: BufferSlot<T>, value: T ): void {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    this.executor.setTypedBufferValue( this.getTypedBuffer( bufferSlot ), value );
  }

  public async getTypedBufferValue<T>( bufferSlot: BufferSlot<T> ): Promise<T> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.getTypedBufferValue( this.getTypedBuffer( bufferSlot ) );
  }

  public async arrayBuffer<T>(
    bufferSlot: BufferSlot<T>
  ): Promise<ArrayBuffer> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.arrayBuffer( this.getBuffer( bufferSlot ) );
  }

  public async u32<T>(
    bufferSlot: BufferSlot<T>
  ): Promise<Uint32Array> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.u32( this.getBuffer( bufferSlot ) );
  }

  public async i32<T>(
    bufferSlot: BufferSlot<T>
  ): Promise<Int32Array> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.i32( this.getBuffer( bufferSlot ) );
  }

  public async f32<T>(
    bufferSlot: BufferSlot<T>
  ): Promise<Float32Array> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.f32( this.getBuffer( bufferSlot ) );
  }

  public async u32Numbers<T>(
    bufferSlot: BufferSlot<T>
  ): Promise<number[]> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.u32Numbers( this.getBuffer( bufferSlot ) );
  }

  public async i32Numbers<T>(
    bufferSlot: BufferSlot<T>
  ): Promise<number[]> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.i32Numbers( this.getBuffer( bufferSlot ) );
  }

  public async f32Numbers<T>(
    bufferSlot: BufferSlot<T>
  ): Promise<number[]> {
    this.releaseComputePass(); // we can't run this during a compute pass, so we'll interrupt if there is one

    return this.executor.f32Numbers( this.getBuffer( bufferSlot ) );
  }

  public finish(): void {
    if ( this.computePass ) {
      this.releaseComputePass();
    }
  }

  private getBuffer<T>( bufferSlot: BufferSlot<T> ): GPUBuffer {
    const resource = this.resourceMap.get( bufferSlot )!;
    assert && assert( resource, 'Missing resource' );

    return resource.resource as GPUBuffer;
  }

  private getTypedBuffer<T>( bufferSlot: BufferSlot<T> ): TypedBuffer<T> {
    const buffer = this.getBuffer( bufferSlot );

    return new TypedBuffer<T>( buffer, bufferSlot.concreteType );
  }

  private getBindGroups( computePipeline: ComputePipeline ): BindGroup[] {
    const bindGroups: BindGroup[] = [];
    for ( const bindGroupLayout of computePipeline.pipelineLayout.bindGroupLayouts ) {
      const bindGroup = this.bindGroupMap.get( bindGroupLayout )!;
      assert && assert( bindGroup, 'Missing bind group' );

      bindGroups.push( bindGroup );
    }
    return bindGroups;
  }

  private ensureComputePass( name: string ): ComputePass {
    if ( this.computePass === null ) {
      this.computePass = this.executor.getComputePass( this.separateComputePasses ? name : 'primary' );
    }
    return this.computePass;
  }

  private releaseComputePass(): void {
    this.computePass?.end();
    this.computePass = null;
  }
}
alpenglow.register( 'ExecutionContext', ExecutionContext );