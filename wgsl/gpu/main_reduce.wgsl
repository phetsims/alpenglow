// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./reduce
#import ./load_reduced
#import ./to_convergent_index
#import ./to_striped_index

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
#option factorOutSubexpressions
#option nestSubexpressions

// We can stripe the output (so the next layer of reduce can read it as striped)
#option stripeOutput

// Whether we should remap the data to convergent indices before reducing (i.e. a convergent reduce with non-commutative
// data.
#option convergentRemap

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
    inputOrder: inputOrder,
    inputAccessOrder: inputAccessOrder,
    factorOutSubexpressions: factorOutSubexpressions,
    nestSubexpressions: nestSubexpressions
  } )}

  ${convergentRemap ? `
    scratch[ ${to_convergent_index( { i: `local_id.x`, size: workgroupSize } )} ] = value;

    workgroupBarrier();
  ` : ``}

  // TODO: good way of combining the valueType/identity/combine*?
  ${reduce( {
    value: 'value',
    scratch: 'scratch',
    workgroupSize: workgroupSize,
    identity: identity,
    combineExpression: combineExpression,
    combineStatements: combineStatements,
    convergent: convergent,
    scratchPreloaded: convergentRemap, // if we convergently reloaded, we don't need to update the scratch
    valuePreloaded: !convergentRemap // if we convergently reloaded, we'll need to load the value from scratch
  } )}

  if ( local_id.x == 0u ) {
    output[ ${stripeOutput ? to_striped_index( {
      i: `workgroup_id.x`,
      workgroupSize: workgroupSize,
      grainSize: grainSize
    } ) : `workgroup_id.x`} ] = value;
  }
}
