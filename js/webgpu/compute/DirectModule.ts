// Copyright 2023-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector3 from '../../../../dot/js/Vector3.js';
import { alpenglow } from '../../alpenglow.js';
import { Module } from './Module.js';
import type { WGSLMainModule } from '../wgsl/WGSLString.js';
import { PIPELINE_BLUEPRINT_DEFAULTS, PipelineBlueprint, PipelineBlueprintOptions } from './PipelineBlueprint.js';

type SelfOptions<T> = {
  main: WGSLMainModule;
  setDispatchSize: ( dispatchSize: Vector3, data: T ) => void;
};

export type DirectModuleOptions<T> = SelfOptions<T> & PipelineBlueprintOptions;

export const DIRECT_MODULE_DEFAULTS = PIPELINE_BLUEPRINT_DEFAULTS;

const scratchVector3 = Vector3.ZERO.copy();

export class DirectModule<T> extends Module<T> {
  public constructor(
    options: DirectModuleOptions<T>
  ) {
    const pipelineBlueprint = new PipelineBlueprint( options );

    options.main.withBlueprint( pipelineBlueprint );

    super( [ pipelineBlueprint ], ( context, data ) => {
      const dispatchSize = scratchVector3.setXYZ( 1, 1, 1 );

      options.setDispatchSize( dispatchSize, data );

      assert && assert( dispatchSize.x >= 1 && dispatchSize.y >= 1 && dispatchSize.z >= 1, `dispatch size to small: ${dispatchSize}` );
      assert && assert( dispatchSize.x <= 65535 && dispatchSize.y <= 65535 && dispatchSize.z <= 65535, `dispatch size too large: ${dispatchSize}` );

      context.dispatch( pipelineBlueprint, dispatchSize.x, dispatchSize.y, dispatchSize.z );
    } );
  }
}
alpenglow.register( 'DirectModule', DirectModule );