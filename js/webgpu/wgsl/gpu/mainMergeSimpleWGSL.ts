// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferBindingType, BufferSlot, CompareOrder, decimalS, mergeSimpleWGSL, PipelineBlueprint, wgsl, WGSLExpressionU32 } from '../../../imports.js';

export type mainMergeSimpleWGSLOptions<T> = {
  inputA: BufferSlot<T[]>;
  inputB: BufferSlot<T[]>;
  output: BufferSlot<T[]>;

  workgroupSize: number;
  grainSize: number;

  order: CompareOrder<T>;

  lengthExpressionA: WGSLExpressionU32; // TODO: support optional
  lengthExpressionB: WGSLExpressionU32; // TODO: support optional
};

export const MAIN_MERGE_SIMPLE_DEFAULTS = {
  // TODO: will need something once we have lengthExpression optional
} as const;

const mainMergeSimpleWGSL = <T>(
  blueprint: PipelineBlueprint,
  options: mainMergeSimpleWGSLOptions<T>
): void => {

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const order = options.order;
  const lengthExpressionA = options.lengthExpressionA;
  const lengthExpressionB = options.lengthExpressionB;

  blueprint.addSlot( 'a', options.inputA, BufferBindingType.READ_ONLY_STORAGE );
  blueprint.addSlot( 'b', options.inputB, BufferBindingType.READ_ONLY_STORAGE );
  blueprint.addSlot( 'c', options.output, BufferBindingType.STORAGE );

  blueprint.add( 'main', wgsl`
    @compute @workgroup_size(${decimalS( workgroupSize )})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${mergeSimpleWGSL( blueprint, {
        lengthA: lengthExpressionA,
        lengthB: lengthExpressionB,
        setFromA: ( indexOutput, indexA ) => wgsl`c[ ${indexOutput} ] = a[ ${indexA} ];`,
        setFromB: ( indexOutput, indexB ) => wgsl`c[ ${indexOutput} ] = b[ ${indexB} ];`,
        grainSize: grainSize,
        compare: ( indexA, indexB ) => order.compareWGSL( wgsl`a[ ${indexA} ]`, wgsl`b[ ${indexB} ]` ),
        greaterThan: ( indexA, indexB ) => order.greaterThanWGSL( wgsl`a[ ${indexA} ]`, wgsl`b[ ${indexB} ]` ),
        lessThanOrEqual: ( indexA, indexB ) => order.lessThanOrEqualWGSL( wgsl`a[ ${indexA} ]`, wgsl`b[ ${indexB} ]` )
      } )}
    }
  ` );
};

export default mainMergeSimpleWGSL;

alpenglow.register( 'mainMergeSimpleWGSL', mainMergeSimpleWGSL );
