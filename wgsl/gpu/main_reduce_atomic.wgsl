// Copyright 2023, University of Colorado Boulder

/**
 * Meant for reduction on u32/i32 values (could be generalized to things that can be represented with multiple atomic
 * values, haven't run into that yet).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./reduce
#import ./load_reduced

#option workgroupSize
#option grainSize
#option length
#option identity
#option combineExpression
#option inputOrder
#option valueType
#option factorOutSubexpressions
#option nestSubexpressions
#option atomicOperation

@group(0) @binding(0)
var<storage> input: array<${valueType}>;
@group(0) @binding(1)
var<storage, read_write> output: atomic<${valueType}>;

var<workgroup> scratch: array<${valueType}, ${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${load_reduced( {
    value: `value`,
    valueType: valueType,
    loadExpression: i => `input[ ${i} ]`,
    identity: identity,
    combineExpression: combineExpression,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: length,
    inputOrder: inputOrder,
    inputAccessOrder: 'striped',
    factorOutSubexpressions: factorOutSubexpressions,
    nestSubexpressions: nestSubexpressions
  } )}

  ${reduce( {
    value: 'value',
    scratch: 'scratch',
    workgroupSize: workgroupSize,
    identity: identity,
    combineExpression: combineExpression,
    convergent: true
  } )}

  if ( local_id.x == 0u ) {
    ${atomicOperation}( &output, value );
  }
}
