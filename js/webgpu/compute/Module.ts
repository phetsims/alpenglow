// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import type { PipelineBlueprint } from './PipelineBlueprint.js';
import type { ExecutionContext } from './ExecutionContext.js';
import type { ResourceSlot } from './ResourceSlot.js';
import { BufferSlot } from './BufferSlot.js';

export class Module<T> {
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