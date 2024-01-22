// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Module, PIPELINE_BLUEPRINT_DEFAULTS, PipelineBlueprint, PipelineBlueprintOptions, WGSLMainModule } from '../../imports.js';
import Vector3 from '../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  main: WGSLMainModule;
  setDispatchSize: ( dispatchSize: Vector3, data: T ) => void;
};

export type DirectModuleOptions<T> = SelfOptions<T> & PipelineBlueprintOptions;

export const DIRECT_MODULE_DEFAULTS = PIPELINE_BLUEPRINT_DEFAULTS;

const scratchVector3 = Vector3.ZERO.copy();

export default class DirectModule<T> extends Module<T> {
  public constructor(
    options: DirectModuleOptions<T>
  ) {
    const pipelineBlueprint = new PipelineBlueprint( options );

    options.main.withBlueprint( pipelineBlueprint );

    super( [ pipelineBlueprint ], ( context, data ) => {
      const dispatchSize = scratchVector3.setXYZ( 1, 1, 1 );

      options.setDispatchSize( dispatchSize, data );

      context.dispatch( pipelineBlueprint, dispatchSize.x, dispatchSize.y, dispatchSize.z );
    } );
  }
}
alpenglow.register( 'DirectModule', DirectModule );
