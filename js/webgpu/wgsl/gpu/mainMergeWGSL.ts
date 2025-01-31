// Copyright 2024-2025, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../../alpenglow.js';
import { BufferSlot } from '../../compute/BufferSlot.js';
import { CompareOrder } from '../../compute/ConcreteType.js';
import { decimalS, wgsl, WGSLExpressionU32, WGSLMainModule, WGSLSlot } from '../WGSLString.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';
import { mergeWGSL } from './mergeWGSL.js';

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

export const mainMergeWGSL = <T>(
  options: mainMergeWGSLOptions<T>
): WGSLMainModule => {

  const workgroupSize = options.workgroupSize;
  const order = options.order;
  const lengthExpressionA = options.lengthExpressionA;
  const lengthExpressionB = options.lengthExpressionB;
  const blockOutputSize = options.blockOutputSize;
  const sharedMemorySize = options.sharedMemorySize;

  return new WGSLMainModule( [
    new WGSLSlot( 'a', options.inputA, BufferBindingType.READ_ONLY_STORAGE ),
    new WGSLSlot( 'b', options.inputB, BufferBindingType.READ_ONLY_STORAGE ),
    new WGSLSlot( 'c', options.output, BufferBindingType.STORAGE )
  ], wgsl`
    var<workgroup> scratch_a: array<${order.type.valueType},${decimalS( sharedMemorySize )}>;
    var<workgroup> scratch_b: array<${order.type.valueType},${decimalS( sharedMemorySize )}>;
    
    @compute @workgroup_size(${decimalS( workgroupSize )})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${mergeWGSL( {
        workgroupA: wgsl`scratch_a`,
        workgroupB: wgsl`scratch_b`,
        loadFromA: indexA => wgsl`a[ ${indexA} ]`,
        loadFromB: indexB => wgsl`b[ ${indexB} ]`,
        storeOutput: ( indexOutput, value ) => wgsl`c[ ${indexOutput} ] = ${value};`,
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

alpenglow.register( 'mainMergeWGSL', mainMergeWGSL );