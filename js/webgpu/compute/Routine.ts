// Copyright 2023-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';
import { alpenglow } from '../../alpenglow.js';
import type { PipelineBlueprint } from './PipelineBlueprint.js';
import type { ResourceSlot } from './ResourceSlot.js';
import { BindGroupLayout } from './BindGroupLayout.js';
import type { DeviceContext } from './DeviceContext.js';
import type { Module } from './Module.js';
import { BufferSlot } from './BufferSlot.js';
import { BufferSlotSlice } from './BufferSlotSlice.js';
import { PipelineLayout } from './PipelineLayout.js';
import { ComputePipeline } from './ComputePipeline.js';
import type { ExecutionContext } from './ExecutionContext.js';
import { BindingDescriptor } from './BindingDescriptor.js';
import type { BindingType } from './BindingType.js';

export class Routine<T, In, Out> {

  public readonly pipelineBlueprints: PipelineBlueprint[];
  public readonly rootResourceSlots: ResourceSlot[];
  public readonly bindGroupLayouts: BindGroupLayout[];

  private constructor(
    public readonly deviceContext: DeviceContext,
    public readonly module: Module<T>,
    public readonly nonBufferSlots: ResourceSlot[],
    public readonly rootBufferSlots: BufferSlot[],
    public readonly bufferSliceMap: Map<BufferSlot<IntentionalAny>, BufferSlotSlice>,
    public readonly pipelineLayoutMap: Map<PipelineBlueprint, PipelineLayout>,
    public readonly computePipelineMap: Map<PipelineBlueprint, ComputePipeline>,
    // TODO: factor out some types?
    public readonly executeWrapper: ( context: ExecutionContext, execute: ( context: ExecutionContext, value: T ) => void, input: In ) => Promise<Out>
  ) {
    this.pipelineBlueprints = module.pipelineBlueprints;
    this.rootResourceSlots = [ ...nonBufferSlots, ...rootBufferSlots ];
    this.bindGroupLayouts = _.uniq( [ ...this.pipelineLayoutMap.values() ].flatMap( layout => layout.bindGroupLayouts ) );
  }

  public execute( context: ExecutionContext, data: In ): Promise<Out> {
    return this.executeWrapper( context, this.module.execute, data );
  }

  public static async create<T, In, Out>(
    deviceContext: DeviceContext,
    module: Module<T>,
    sharedBufferSlots: BufferSlot<IntentionalAny>[],
    layoutStrategy: ( deviceContext: DeviceContext, pipelineBlueprints: PipelineBlueprint[] ) => Map<PipelineBlueprint, PipelineLayout>,
    executeWrapper: ( context: ExecutionContext, execute: ( context: ExecutionContext, value: T ) => void, value: In ) => Promise<Out>
  ): Promise<Routine<T, In, Out>> {
    const slots = _.uniq( [
      ...sharedBufferSlots,
      ...module.getResourceSlots()
    ] );

    const nonBufferSlots = slots.filter( slot => !( slot instanceof BufferSlot ) );
    const bufferSlots = slots.filter( slot => slot instanceof BufferSlot ) as BufferSlot[];
    const rootBufferSlots = bufferSlots.filter( slot => {
      return !bufferSlots.some( otherSlot => otherSlot.hasChildSlot( slot ) );
    } );

    const bufferSliceMap = new Map<BufferSlot, BufferSlotSlice>();
    const recur = ( rootSlot: BufferSlot, slot: BufferSlot, offset: number ) => {
      bufferSliceMap.set( slot, new BufferSlotSlice( rootSlot, offset ) );
      for ( const slice of slot.bufferSlotSlices ) {
        recur( rootSlot, slice.bufferSlot, offset + slice.offset );
      }
    };
    for ( const slot of rootBufferSlots ) {
      recur( slot, slot, 0 );
    }

    // NOTE: Do bind group/pipeline layouts AFTER we figure out buffer slices recursively, since if we add dynamic
    // offsets, we'll need to know that before computing the layouts.

    const pipelineLayoutMap = layoutStrategy( deviceContext, module.pipelineBlueprints );

    const computePipelineMap = new Map<PipelineBlueprint, ComputePipeline>();
    for ( const pipelineBlueprint of _.uniq( module.pipelineBlueprints ) ) {
      const pipelineLayout = pipelineLayoutMap.get( pipelineBlueprint )!;
      assert && assert( pipelineLayout, 'Missing pipeline layout' );

      computePipelineMap.set( pipelineBlueprint, await ComputePipeline.withContextAsync(
        deviceContext,
        pipelineBlueprint.name,
        pipelineBlueprint.toString( pipelineLayout ),
        pipelineLayout
      ) );
    }

    return new Routine(
      deviceContext,
      module,
      nonBufferSlots,
      rootBufferSlots,
      bufferSliceMap,
      pipelineLayoutMap,
      computePipelineMap,
      executeWrapper
    );
  }

  // TODO: Since we're returning a map, it's enforcing "no different layouts for different locations of the same blueprint"
  // TODO: which is less than ideal(!). Figure this out, and possibly different bind groups for the same bind group layout.
  public static readonly INDIVIDUAL_LAYOUT_STRATEGY = (
    deviceContext: DeviceContext,
    pipelineBlueprints: PipelineBlueprint[]
  ): Map<PipelineBlueprint, PipelineLayout> => {
    const map = new Map<PipelineBlueprint, PipelineLayout>();
    _.uniq( pipelineBlueprints ).forEach( pipelineBlueprint => {
      const bindGroupLayout = new BindGroupLayout(
        deviceContext,
        pipelineBlueprint.name,
        0,
        pipelineBlueprint.usages.map( ( usage, index ) => {
          return new BindingDescriptor( index, usage.bindingType, usage.resourceSlot );
        } )
      );
      const pipelineLayout = new PipelineLayout( deviceContext, [ bindGroupLayout ] );
      map.set( pipelineBlueprint, pipelineLayout );
    } );
    return map;
  };

  public static readonly COMBINE_ALL_LAYOUT_STRATEGY = (
    deviceContext: DeviceContext,
    pipelineBlueprints: PipelineBlueprint[]
  ): Map<PipelineBlueprint, PipelineLayout> => {
    const slots = _.uniq( pipelineBlueprints.flatMap( pipelineBlueprint => pipelineBlueprint.usages.map( usage => usage.resourceSlot ) ) );

    const bindingDescriptors = slots.map( ( slot, index ) => {
      // Compute the binding type
      let bindingType: BindingType | null = null;
      for ( const pipelineBlueprint of pipelineBlueprints ) {
        const usage = pipelineBlueprint.usages.find( usage => usage.resourceSlot === slot );
        if ( usage ) {
          if ( !bindingType ) {
            bindingType = usage.bindingType;
          }
          else {
            bindingType = bindingType.combined( usage.bindingType );
          }
        }
      }
      assert && assert( bindingType, 'Missing binding type' );
      return new BindingDescriptor( index, bindingType!, slot );
    } );

    const bindGroupLayout = new BindGroupLayout(
      deviceContext,
      'combine all',
      0,
      bindingDescriptors
    );
    const pipelineLayout = new PipelineLayout( deviceContext, [ bindGroupLayout ] );
    const map = new Map<PipelineBlueprint, PipelineLayout>();
    _.uniq( pipelineBlueprints ).forEach( pipelineBlueprint => {
      map.set( pipelineBlueprint, pipelineLayout );
    } );
    return map;
  };
}
alpenglow.register( 'Routine', Routine );