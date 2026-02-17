// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { combineOptions } from '../../../../phet-core/js/optionize.js';
import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';
import { alpenglow } from '../../alpenglow.js';
import { Executor, ExecutorOptions } from './Executor.js';
import type { Routine } from './Routine.js';
import type { ResourceSlot } from './ResourceSlot.js';
import type { Resource } from './Resource.js';
import type { BindGroupLayout } from './BindGroupLayout.js';
import { BindGroup } from './BindGroup.js';
import { BufferSlot } from './BufferSlot.js';
import { BufferResource } from './BufferResource.js';
import type { TextureViewSlot } from './TextureViewSlot.js';
import type { TextureViewResource } from './TextureViewResource.js';
import { BufferBindingType } from './BufferBindingType.js';
import { webgpu } from '../WebGPUAPI.js';
import { ExecutionContext } from './ExecutionContext.js';
import type { DeviceContext } from './DeviceContext.js';
import { logBufferSlot } from './logBufferSlot.js';

export type ProcedureExecuteOptions = {
  separateComputePasses?: boolean;
};

export type ProcedureStandaloneExecuteOptions = {
  procedureExecuteOptions?: ProcedureExecuteOptions;
  executorOptions?: ExecutorOptions;
};

const emptyOptions = {} as const;

export class Procedure<In, Out> {

  private readonly selfBuffers: GPUBuffer[] = [];

  public constructor(
    public readonly routine: Routine<IntentionalAny, In, Out>,
    public readonly resourceMap: Map<ResourceSlot, Resource> = new Map<ResourceSlot, Resource>(),
    public readonly bindGroupMap: Map<BindGroupLayout, BindGroup> = new Map<BindGroupLayout, BindGroup>()
  ) {}

  public bind( slot: ResourceSlot, resource: Resource ): this {
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

    return this;
  }

  // Should be callable repeatedly (TODO test)
  public bindTexture( textureSlot: TextureViewSlot, resource: TextureViewResource ): this {

    if ( this.resourceMap.has( textureSlot ) ) {
      // Remove from the resource map
      this.resourceMap.delete( textureSlot );

      // Remove bind groups that have this texture slot
      this.routine.bindGroupLayouts.forEach( bindGroupLayout => {
        if ( this.bindGroupMap.has( bindGroupLayout ) ) {
          if ( bindGroupLayout.bindings.some( binding => binding.slot === textureSlot ) ) {
            this.bindGroupMap.delete( bindGroupLayout );
          }
        }
      } );
    }

    this.bind( textureSlot, resource );

    return this;
  }

  public bindRemainingBuffers(): this {
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

      // TODO: add a label!
      const buffer = webgpu.deviceCreateBuffer( this.routine.deviceContext.device, {
        size: slot.size,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | ( storageUsage ? GPUBufferUsage.STORAGE : 0 ) | ( uniformUsage ? GPUBufferUsage.UNIFORM : 0 )
      } );
      this.selfBuffers.push( buffer );
      this.bind( slot, new BufferResource( buffer ) );
    }

    return this;
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

  public standaloneExecute( deviceContext: DeviceContext, data: In, options?: ProcedureStandaloneExecuteOptions ): Promise<Out> {
    const executorOptions = combineOptions<ExecutorOptions>( {
      logBuffer: this.getLogBuffer()
    }, options?.executorOptions );

    return Executor.execute( deviceContext, async executor => {
      return this.execute( executor, data, options?.procedureExecuteOptions || emptyOptions );
    }, executorOptions );
  }

  public getLogBuffer(): GPUBuffer | null {
    const resource = this.resourceMap.get( logBufferSlot );
    if ( resource ) {
      return ( resource as BufferResource ).buffer;
    }
    else {
      return null;
    }
  }

  public dispose(): void {
    this.selfBuffers.forEach( buffer => webgpu.bufferDestroy( buffer ) );
  }
}
alpenglow.register( 'Procedure', Procedure );