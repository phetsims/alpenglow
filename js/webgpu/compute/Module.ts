// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferSlot, ExecutionContext, PipelineBlueprint, ResourceSlot } from '../../imports.js';

export default class Module<T> {
  public constructor(
    public readonly pipelineBlueprints: PipelineBlueprint[],
    public readonly execute: ( context: ExecutionContext, data: T ) => void
  ) {}

  public getResourceSlots(): ResourceSlot[] {
    const resourceSlots = new Set<ResourceSlot>();
    for ( const pipelineBlueprint of this.pipelineBlueprints ) {
      for ( const usage of pipelineBlueprint.usages ) {
        resourceSlots.add( usage.resourceSlot );
      }
    }
    return Array.from( resourceSlots );
  }

  public getTopLevelResourceSlots( sharedBufferSlots: BufferSlot[] ): ResourceSlot[] {
    const slots = _.uniq( [
      ...this.getResourceSlots(),
      ...sharedBufferSlots
    ] );

    const nonBufferSlots = slots.filter( slot => !( slot instanceof BufferSlot ) );
    const bufferSlots = slots.filter( slot => slot instanceof BufferSlot ) as BufferSlot[];

    return [
      ...nonBufferSlots,
      ...bufferSlots.filter( slot => {
        return !bufferSlots.some( otherSlot => otherSlot.hasChildSlot( slot ) );
      } )
    ];
  }
}
alpenglow.register( 'Module', Module );