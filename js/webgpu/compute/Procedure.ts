// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroup, BindGroupLayout, BufferBindingType, BufferResource, ExecutionContext, Executor, Resource, ResourceSlot, Routine } from '../../imports.js';
import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';
import BufferSlot from './BufferSlot.js';

export type ProcedureExecuteOptions = {
  separateComputePasses?: boolean;
};

export default class Procedure<In, Out> {

  private readonly selfBuffers: GPUBuffer[] = [];

  public constructor(
    public readonly routine: Routine<IntentionalAny, In, Out>,
    public readonly resourceMap: Map<ResourceSlot, Resource> = new Map<ResourceSlot, Resource>(),
    public readonly bindGroupMap: Map<BindGroupLayout, BindGroup> = new Map<BindGroupLayout, BindGroup>()
  ) {}

  public bind( slot: ResourceSlot, resource: Resource ): void {
    assert && assert( !this.resourceMap.has( slot ), 'Already bound' );
    assert && assert( this.routine.rootResourceSlots.includes( slot ), 'Not a root resource slot' );

    // Set the root resource
    this.resourceMap.set( slot, resource );

    // If it is a buffer resource, recursively visit slices and set them up in the resource map
    if ( slot instanceof BufferSlot && resource instanceof BufferResource ) {
      const recur = ( slot: BufferSlot, resource: BufferResource ): void => {
        for ( const slice of slot.bufferSlotSlices ) {
          const subSlot = slice.bufferSlot;

          // TODO: handle buffer sizes! We can explicitly pass them in, in that case?
          const subResource = new BufferResource( resource.buffer, resource.offset + slice.offset );

          this.resourceMap.set( subSlot, subResource );
          recur( subSlot, subResource );
        }
      };
      recur( slot, resource );
    }

    this.routine.bindGroupLayouts.forEach( bindGroupLayout => {
      if ( !this.bindGroupMap.has( bindGroupLayout ) ) {
        if ( bindGroupLayout.bindings.every( binding => this.resourceMap.has( binding.slot ) ) ) {
          this.bindGroupMap.set( bindGroupLayout, new BindGroup(
            this.routine.deviceContext,
            bindGroupLayout.name,
            bindGroupLayout,
            this.resourceMap
          ) );
        }
      }
    } );
  }

  public bindRemainingBuffers(): void {
    for ( const slot of this.routine.rootBufferSlots ) {
      if ( this.resourceMap.has( slot ) ) {
        continue;
      }

      let storageUsage = false;
      let uniformUsage = false;
      const subtreeSlots = slot.getSubtreeSlots();
      this.routine.pipelineBlueprints.forEach( pipelineBlueprint => {
        const usage = pipelineBlueprint.usages.find( usage => subtreeSlots.includes( usage.resourceSlot as BufferSlot ) );

        if ( usage && usage.bindingType instanceof BufferBindingType ) {
          if ( usage.bindingType.type === 'uniform' ) {
            uniformUsage = true;
          }
          else {
            storageUsage = true;
          }
        }
      } );

      assert && assert( storageUsage || uniformUsage );

      const buffer = this.routine.deviceContext.device.createBuffer( {
        // TODO: a label!
        // label: `${this.routine.module.name} ${slot}`,
        size: slot.size,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | ( storageUsage ? GPUBufferUsage.STORAGE : 0 ) | ( uniformUsage ? GPUBufferUsage.UNIFORM : 0 )
      } );
      this.selfBuffers.push( buffer );
      this.bind( slot, new BufferResource( buffer ) );
    }
  }

  public createChild(): Procedure<In, Out> {
    return new Procedure(
      this.routine,
      new Map( this.resourceMap ),
      new Map( this.bindGroupMap )
    );
  }

  public execute( executor: Executor, data: In, options?: ProcedureExecuteOptions ): Promise<Out> {
    const separateComputePasses = ( options && options.separateComputePasses ) || false;

    const context = new ExecutionContext( executor, this.routine.computePipelineMap, this.bindGroupMap, this.resourceMap, separateComputePasses );

    const resultPromise = this.routine.execute( context, data );

    context.finish();

    return resultPromise;
  }

  public dispose(): void {
    this.selfBuffers.forEach( buffer => buffer.destroy() );
  }
}
alpenglow.register( 'Procedure', Procedure );
