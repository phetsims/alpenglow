// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferBindingType, BufferSlot, CompareOrder, mergeWGSL, PipelineBlueprint, WGSLExpressionU32 } from '../../../imports.js';

export type mainMergeWGSLOptions<T> = {
  inputA: BufferSlot<T[]>;
  inputB: BufferSlot<T[]>;
  output: BufferSlot<T[]>;

  workgroupSize: number;

  blockOutputSize: number;

  // should be a divisor of blockOutputSize, and ideally a multiple of workgroupSize
  sharedMemorySize: number;

  order: CompareOrder<T>;

  lengthExpressionA: WGSLExpressionU32; // TODO: support optional
  lengthExpressionB: WGSLExpressionU32; // TODO: support optional
};

export const MAIN_MERGE_DEFAULTS = {
  // TODO: will need something once we have lengthExpression optional
} as const;

const mainMergeWGSL = <T>(
  blueprint: PipelineBlueprint,
  options: mainMergeWGSLOptions<T>
): void => {

  const workgroupSize = options.workgroupSize;
  const order = options.order;
  const lengthExpressionA = options.lengthExpressionA;
  const lengthExpressionB = options.lengthExpressionB;
  const blockOutputSize = options.blockOutputSize;
  const sharedMemorySize = options.sharedMemorySize;

  blueprint.addSlot( 'a', options.inputA, BufferBindingType.READ_ONLY_STORAGE );
  blueprint.addSlot( 'b', options.inputB, BufferBindingType.READ_ONLY_STORAGE );
  blueprint.addSlot( 'c', options.output, BufferBindingType.STORAGE );

  blueprint.add( 'main', `
    var<workgroup> scratch_a: array<${order.type.valueType( blueprint )},${sharedMemorySize}>;
    var<workgroup> scratch_b: array<${order.type.valueType( blueprint )},${sharedMemorySize}>;
    
    @compute @workgroup_size(${workgroupSize})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${mergeWGSL( blueprint, {
        workgroupA: 'scratch_a',
        workgroupB: 'scratch_b',
        loadFromA: indexA => `a[ ${indexA} ]`,
        loadFromB: indexB => `b[ ${indexB} ]`,
        storeOutput: ( indexOutput, value ) => `c[ ${indexOutput} ] = ${value};`,
        lengthA: lengthExpressionA,
        lengthB: lengthExpressionB,
        workgroupSize: workgroupSize,
        blockOutputSize: blockOutputSize,
        sharedMemorySize: sharedMemorySize,
        compare: order.compareWGSL,
        greaterThan: order.greaterThanWGSL,
        lessThanOrEqual: order.lessThanOrEqualWGSL,
        atomicConsumed: true // TODO: allow override and things
      } )}
    }
  ` );
};

export default mainMergeWGSL;

alpenglow.register( 'mainMergeWGSL', mainMergeWGSL );
