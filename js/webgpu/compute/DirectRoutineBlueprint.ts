// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, PIPELINE_BLUEPRINT_DEFAULTS, PipelineBlueprint, PipelineBlueprintOptions, RoutineBlueprint } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';
import Vector3 from '../../../../dot/js/Vector3.js';

export type DirectRoutineBlueprintOptions<T> = {
  setup: ( blueprint: PipelineBlueprint ) => void;
  setDispatchSize: ( dispatchSize: Vector3, data: T ) => void;
} & PipelineBlueprintOptions;

const DIRECT_ROUTINE_BLUEPRINT_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...PIPELINE_BLUEPRINT_DEFAULTS
} as const;

const scratchVector3 = Vector3.ZERO.copy();

export default class DirectRoutineBlueprint<T> extends RoutineBlueprint<T> {
  public constructor(
    providedOptions: DirectRoutineBlueprintOptions<T>
  ) {
    const options = optionize3<DirectRoutineBlueprintOptions<T>>()( {}, DIRECT_ROUTINE_BLUEPRINT_DEFAULTS, providedOptions );

    const pipelineBlueprint = new PipelineBlueprint( options );
    options.setup( pipelineBlueprint );

    super( [ pipelineBlueprint ], ( context, data ) => {
      const dispatchSize = scratchVector3.setXYZ( 1, 1, 1 );

      options.setDispatchSize( dispatchSize, data );

      context.dispatch( pipelineBlueprint, dispatchSize.x, dispatchSize.y, dispatchSize.z );
    } );
  }
}
alpenglow.register( 'DirectRoutineBlueprint', DirectRoutineBlueprint );
