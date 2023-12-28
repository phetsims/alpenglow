// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroupLayout, BindingDescriptor, BufferSlot, BufferSlotSlice, ComputePipeline, DeviceContext, PipelineBlueprint, PipelineLayout, ResourceSlot, RoutineBlueprint } from '../../imports.js';
import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';

export default class Routine<T> {

  public readonly pipelineBlueprints: PipelineBlueprint[];
  public readonly rootResourceSlots: ResourceSlot[];
  public readonly bindGroupLayouts: BindGroupLayout[];

  private constructor(
    public readonly deviceContext: DeviceContext,
    public readonly routineBlueprint: RoutineBlueprint<T>,
    public readonly nonBufferSlots: ResourceSlot[],
    public readonly rootBufferSlots: BufferSlot[],
    public readonly bufferSliceMap: Map<BufferSlot<IntentionalAny>, BufferSlotSlice>,
    public readonly pipelineLayoutMap: Map<PipelineBlueprint, PipelineLayout>,
    public readonly computePipelineMap: Map<PipelineBlueprint, ComputePipeline>
  ) {
    this.pipelineBlueprints = routineBlueprint.pipelineBlueprints;
    this.rootResourceSlots = [ ...nonBufferSlots, ...rootBufferSlots ];
    this.bindGroupLayouts = _.uniq( [ ...this.pipelineLayoutMap.values() ].flatMap( layout => layout.bindGroupLayouts ) );
  }

  public static async create<T>(
    deviceContext: DeviceContext,
    routineBlueprint: RoutineBlueprint<T>,
    sharedBufferSlots: BufferSlot[],
    layoutStrategy: ( deviceContext: DeviceContext, pipelineBlueprints: PipelineBlueprint[] ) => Map<PipelineBlueprint, PipelineLayout>
  ): Promise<Routine<T>> {
    const slots = _.uniq( [
      ...sharedBufferSlots,
      ...routineBlueprint.getResourceSlots()
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

    const pipelineLayoutMap = layoutStrategy( deviceContext, routineBlueprint.pipelineBlueprints );

    const computePipelineMap = new Map<PipelineBlueprint, ComputePipeline>();
    for ( const pipelineBlueprint of routineBlueprint.pipelineBlueprints ) {
      const pipelineLayout = pipelineLayoutMap.get( pipelineBlueprint )!;
      assert && assert( pipelineLayout, 'Missing pipeline layout' );

      computePipelineMap.set( pipelineBlueprint, await pipelineBlueprint.toComputePipeline(
        deviceContext, pipelineLayout
      ) );
    }

    return new Routine(
      deviceContext,
      routineBlueprint,
      nonBufferSlots,
      rootBufferSlots,
      bufferSliceMap,
      pipelineLayoutMap,
      computePipelineMap
    );
  }

  public static readonly INDIVIDUAL_LAYOUT_STRATEGY = (
    deviceContext: DeviceContext,
    pipelineBlueprints: PipelineBlueprint[]
  ): Map<PipelineBlueprint, PipelineLayout> => {
    const map = new Map<PipelineBlueprint, PipelineLayout>();
    pipelineBlueprints.forEach( pipelineBlueprint => {
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
}
alpenglow.register( 'Routine', Routine );
