// Copyright 2023, University of Colorado Boulder

/**
 * Like main_scan, but with the same input/output.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./scan_comprehensive

#option workgroupSize
#option grainSize
#option length
#option identity
#option combineExpression
#option combineStatements
#option inputOrder
#option inputAccessOrder
#option valueType
#option factorOutSubexpressions
#option exclusive
#option getAddedValue

@group(0) @binding(0)
var<storage, read_write> data: array<${valueType}>;

var<workgroup> scratch: array<${valueType}, ${workgroupSize * grainSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${scan_comprehensive( {
    input: `data`,
    output: `data`,
    scratch: `scratch`,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: length,
    identity: identity,
    combineExpression: combineExpression,
    combineStatements: combineStatements,
    inputOrder: inputOrder,
    inputAccessOrder: inputAccessOrder,
    valueType: valueType,
    factorOutSubexpressions: factorOutSubexpressions,
    exclusive: exclusive,
    getAddedValue: getAddedValue,
  } )}
}
