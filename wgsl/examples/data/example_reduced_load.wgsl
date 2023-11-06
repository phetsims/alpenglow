// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/reduced_load

#option workgroupSize
#option grainSize
#option valueType
#option useLoadExpression
#option identity
#option length
#option combineExpression
#option combineStatements
#option inputOrder
#option inputAccessOrder
#option factorOutSubexpressions
#option nestSubexpressions

@group(0) @binding(0)
var<storage> input: array<${valueType}>;
@group(0) @binding(1)
var<storage, read_write> output: array<${valueType}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {

  ${reduced_load( {
    value: `val`,
    valueType: valueType,
    loadExpression: useLoadExpression ? index => `input[ ${index} ]` : null,
    loadStatements: useLoadExpression ? null : ( varName, index ) => `${varName} = input[ ${index} ];`,
    identity: identity,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: length,
    combineExpression: combineExpression,
    combineStatements: combineStatements,
    inputOrder: inputOrder,
    inputAccessOrder: inputAccessOrder,
    factorOutSubexpressions: factorOutSubexpressions,
    nestSubexpressions: nestSubexpressions,
  } )}

  output[ global_id.x ] = val;
}
