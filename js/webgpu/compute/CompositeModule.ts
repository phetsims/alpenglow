// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';
import { alpenglow } from '../../alpenglow.js';
import { Module } from './Module.js';
import type { ExecutionContext } from './ExecutionContext.js';

export class CompositeModule<T> extends Module<T> {
  public constructor(
    public readonly modules: Module<IntentionalAny>[],
    execute: ( context: ExecutionContext, data: T ) => void
  ) {
    super( modules.flatMap( module => module.pipelineBlueprints ), execute );
  }
}
alpenglow.register( 'CompositeModule', CompositeModule );