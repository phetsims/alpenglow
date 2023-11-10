// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/load_multiple
#import ../../gpu/unroll

#option useLoadExpression
#option valueType
#option workgroupSize
#option grainSize
#option length
#option outOfRangeValue
#option inputOrder
#option inputAccessOrder
#option factorOutSubexpressions

@group(0) @binding(0)
var<storage> input: array<${valueType}>;
@group(0) @binding(1)
var<storage, read_write> output: array<${valueType}>;

var<workgroup> scratch: array<${valueType}, ${workgroupSize * grainSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {

  ${load_multiple( {
    loadExpression: useLoadExpression ? index => `input[ ${index} ]` : null,
    loadStatements: useLoadExpression ? null : ( varName, index ) => `${varName} = input[ ${index} ];`,
    storeStatements: ( index, value ) => `scratch[ ${index} ] = ${value};`,
    valueType: valueType,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: length,
    outOfRangeValue: outOfRangeValue,
    inputOrder: inputOrder,
    inputAccessOrder: inputAccessOrder,
    factorOutSubexpressions: factorOutSubexpressions,
  } )}

  workgroupBarrier();

  // NON-STRIPED, INEFFICIENT!!!
  ${unroll( 0, grainSize, i => `
    {
      let local_index = local_id.x * ${u32( grainSize )} + ${u32( i )};
      output[ workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_index ] = scratch[ local_index ];
    }
  ` )}
}
