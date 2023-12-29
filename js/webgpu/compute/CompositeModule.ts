// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ExecutionContext, Module } from '../../imports.js';
import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';

export default class CompositeModule<T> extends Module<T> {
  public constructor(
    public readonly modules: Module<IntentionalAny>[],
    execute: ( context: ExecutionContext, data: T ) => void
  ) {
    super( modules.flatMap( module => module.pipelineBlueprints ), execute );
  }
}
alpenglow.register( 'CompositeModule', CompositeModule );
