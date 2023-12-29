// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, PIPELINE_BLUEPRINT_DEFAULTS, PipelineBlueprint, PipelineBlueprintOptions, Module } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';
import Vector3 from '../../../../dot/js/Vector3.js';

export type DirectModuleOptions<T> = {
  setup: ( blueprint: PipelineBlueprint ) => void;
  setDispatchSize: ( dispatchSize: Vector3, data: T ) => void;
} & PipelineBlueprintOptions;

export const DIRECT_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...PIPELINE_BLUEPRINT_DEFAULTS
} as const;

const scratchVector3 = Vector3.ZERO.copy();

export default class DirectModule<T> extends Module<T> {
  public constructor(
    providedOptions: DirectModuleOptions<T>
  ) {
    const options = optionize3<DirectModuleOptions<T>>()( {}, DIRECT_MODULE_DEFAULTS, providedOptions );

    const pipelineBlueprint = new PipelineBlueprint( options );
    options.setup( pipelineBlueprint );

    super( [ pipelineBlueprint ], ( context, data ) => {
      const dispatchSize = scratchVector3.setXYZ( 1, 1, 1 );

      options.setDispatchSize( dispatchSize, data );

      context.dispatch( pipelineBlueprint, dispatchSize.x, dispatchSize.y, dispatchSize.z );
    } );
  }
}
alpenglow.register( 'DirectModule', DirectModule );
