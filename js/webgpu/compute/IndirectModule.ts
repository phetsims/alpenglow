// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ExecutionContext, PIPELINE_BLUEPRINT_DEFAULTS, PipelineBlueprint, PipelineBlueprintOptions, Module } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';

export type IndirectModuleOptions<T> = {
  create: ( blueprint: PipelineBlueprint ) => void;
  // TODO: BufferSlot?
  execute: ( context: ExecutionContext, dispatch: ( context: ExecutionContext, indirectBuffer: GPUBuffer, indirectOffset: number ) => void, data: T ) => void;
} & PipelineBlueprintOptions;

export const INDIRECT_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...PIPELINE_BLUEPRINT_DEFAULTS
} as const;

export default class IndirectModule<T> extends Module<T> {
  public constructor(
    providedOptions: IndirectModuleOptions<T>
  ) {
    const options = optionize3<IndirectModuleOptions<T>>()( {}, INDIRECT_MODULE_DEFAULTS, providedOptions );

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
alpenglow.register( 'IndirectModule', IndirectModule );
