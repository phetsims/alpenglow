// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroup, BindGroupLayout, BufferBindingType, BufferResource, ExecutionContext, Executor, Resource, ResourceSlot, Routine } from '../../imports.js';
import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';

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

    this.resourceMap.set( slot, resource );

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
      this.routine.pipelineBlueprints.forEach( pipelineBlueprint => {
        const usage = pipelineBlueprint.usages.find( usage => usage.resourceSlot === slot );

        if ( usage && usage.bindingType instanceof BufferBindingType ) {
          if ( usage.bindingType.type === 'uniform' ) {
            uniformUsage = true;
          }
          else {
            storageUsage = true;
          }
        }
      } );

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
