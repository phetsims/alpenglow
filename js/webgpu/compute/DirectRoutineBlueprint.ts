// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ExecutionContext, PIPELINE_BLUEPRINT_DEFAULTS, PipelineBlueprint, PipelineBlueprintOptions, RoutineBlueprint } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';

export type DirectRoutineBlueprintOptions<T> = {
  create: ( blueprint: PipelineBlueprint ) => void;
  execute: ( context: ExecutionContext, dispatch: ( context: ExecutionContext, dispatchX?: number, dispatchY?: number, dispatchZ?: number ) => void, data: T ) => void;
} & PipelineBlueprintOptions;

const DIRECT_ROUTINE_BLUEPRINT_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...PIPELINE_BLUEPRINT_DEFAULTS
} as const;

export default class DirectRoutineBlueprint<T> extends RoutineBlueprint<T> {
  public constructor(
    providedOptions: DirectRoutineBlueprintOptions<T>
  ) {
    const options = optionize3<DirectRoutineBlueprintOptions<T>>()( {}, DIRECT_ROUTINE_BLUEPRINT_DEFAULTS, providedOptions );

    const pipelineBlueprint = new PipelineBlueprint( options );
    options.create( pipelineBlueprint );

    const dispatch = ( context: ExecutionContext, dispatchX = 1, dispatchY = 1, dispatchZ = 1 ) => {
      context.dispatch( pipelineBlueprint, dispatchX, dispatchY, dispatchZ );
    };

    super( [ pipelineBlueprint ], ( context, data ) => {
      options.execute( context, dispatch, data );
    } );
  }
}
alpenglow.register( 'DirectRoutineBlueprint', DirectRoutineBlueprint );
