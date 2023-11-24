// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * TODO: Roll this into main_scan
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
#option stripeReducedOutput
#option inPlace

${inPlace ? `
  @group(0) @binding(0)
  var<storage, read_write> data: array<${valueType}>;
` : `
  @group(0) @binding(0)
  var<storage> input: array<${valueType}>;
  @group(0) @binding(1)
  var<storage, read_write> output: array<${valueType}>;
`}
@group(0) @binding(${inPlace ? 1 : 2})
var<storage, read_write> reductions: array<${valueType}>;

var<workgroup> scratch: array<${valueType}, ${workgroupSize * grainSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${scan_comprehensive( {
    input: inPlace ? `data` : `input`,
    output: inPlace ? `data` : `output`,
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
    storeReduction: ( index, value ) => `reductions[ ${index} ] = ${value};`,
    stripeReducedOutput: stripeReducedOutput,
  } )}
}
