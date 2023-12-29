// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ExecutionContext, PIPELINE_BLUEPRINT_DEFAULTS, PipelineBlueprint, PipelineBlueprintOptions, RoutineBlueprint } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';

export type IndirectRoutineBlueprintOptions<T> = {
  create: ( blueprint: PipelineBlueprint ) => void;
  // TODO: BufferSlot?
  execute: ( context: ExecutionContext, dispatch: ( context: ExecutionContext, indirectBuffer: GPUBuffer, indirectOffset: number ) => void, data: T ) => void;
} & PipelineBlueprintOptions;

const DIRECT_ROUTINE_BLUEPRINT_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...PIPELINE_BLUEPRINT_DEFAULTS
} as const;

export default class IndirectRoutineBlueprint<T> extends RoutineBlueprint<T> {
  public constructor(
    providedOptions: IndirectRoutineBlueprintOptions<T>
  ) {
    const options = optionize3<IndirectRoutineBlueprintOptions<T>>()( {}, DIRECT_ROUTINE_BLUEPRINT_DEFAULTS, providedOptions );

    const pipelineBlueprint = new PipelineBlueprint( options );
    options.create( pipelineBlueprint );

    const dispatch = ( context: ExecutionContext, indirectBuffer: GPUBuffer, indirectOffset = 0 ) => {
      context.dispatchIndirect( pipelineBlueprint, indirectBuffer, indirectOffset );
    };

    super( [ pipelineBlueprint ], ( context, data ) => {
      options.execute( context, dispatch, data );
    } );
  }
}
alpenglow.register( 'IndirectRoutineBlueprint', IndirectRoutineBlueprint );
