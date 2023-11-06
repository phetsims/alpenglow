// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/reduce
#import ../../gpu/load_reduced

#option workgroupSize
#option grainSize
#option length
#option identity
#option combineExpression
#option combineStatements
#option convergent
#option inputOrder
#option inputAccessOrder
#option valueType

@group(0) @binding(0)
var<storage> input: array<${valueType}>;
@group(0) @binding(1)
var<storage, read_write> output: array<${valueType}>;

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
    combineStatements: combineStatements,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: length,
    inputOrder: 'blocked',
    inputAccessOrder: 'blocked'
  } )}

  // TODO: good way of combining the valueType/identity/combine*?
  ${reduce( {
    value: 'value',
    valueType: valueType,
    scratch: 'scratch',
    workgroupSize: workgroupSize,
    identity: identity,
    combineExpression: combineExpression,
    combineStatements: combineStatements,
    convergent: convergent
  } )}

  if ( local_id.x == 0u ) {
    output[ workgroup_id.x ] = value;
  }
}
