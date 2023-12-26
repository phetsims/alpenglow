// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroup, BindGroupLayout, BufferBindingType, BufferResource, ExecutionContext, Executor, Resource, ResourceSlot, Routine } from '../../imports.js';

export type ProcedureExecuteOptions = {
  separateComputePasses?: boolean;
};

export default class Procedure<T> {

  private readonly selfBuffers: GPUBuffer[] = [];

  public constructor(
    public readonly routine: Routine<T>,
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

  public bindAllBuffers(): void {
    for ( const slot of this.routine.rootBufferSlots ) {
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
        // label: `${this.routine.routineBlueprint.name} ${slot}`,
        size: slot.size,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | ( storageUsage ? GPUBufferUsage.STORAGE : 0 ) | ( uniformUsage ? GPUBufferUsage.UNIFORM : 0 )
      } );
      this.selfBuffers.push( buffer );
      this.bind( slot, new BufferResource( buffer ) );
    }
  }

  public createChild(): Procedure<T> {
    return new Procedure(
      this.routine,
      new Map( this.resourceMap ),
      new Map( this.bindGroupMap )
    );
  }

  public execute( executor: Executor, data: T, options?: ProcedureExecuteOptions ): void {
    const separateComputePasses = ( options && options.separateComputePasses ) || false;

    const context = new ExecutionContext( executor, this.routine.computePipelineMap, this.bindGroupMap, this.resourceMap, separateComputePasses );

    this.routine.routineBlueprint.execute( context, data );

    context.finish();
  }

  public dispose(): void {
    this.selfBuffers.forEach( buffer => buffer.destroy() );
  }
}
alpenglow.register( 'Procedure', Procedure );
