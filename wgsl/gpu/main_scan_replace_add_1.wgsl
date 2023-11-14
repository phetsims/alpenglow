// Copyright 2023, University of Colorado Boulder

/**
 * Like main_scan, but replaces the content in the input array with the scan result, and adds a value from an array of
 * scanned reductions.
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
#option isReductionExclusive

@group(0) @binding(0)
var<storage> input: array<${valueType}>;
@group(0) @binding(1)
var<storage> scanned_reduction: array<${valueType}>;
@group(0) @binding(2)
var<storage, read_write> output: array<${valueType}>;

var<workgroup> scratch: array<${valueType}, ${workgroupSize * grainSize}>;

var<workgroup> reduction_value: ${valueType};

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${scan_comprehensive( {
    input: `input`,
    output: `output`,
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
    getAddedValue: addedValue => `
      if ( local_id.x == 0u ) {
        // If our reductions are scanned exclusively, then we can just use the value directly
        ${isReductionExclusive ? `
          reduction_value = scanned_reduction[ workgroup_id.x ];
        ` : `
          // NOTE: assumes the same workgroup/grain size for each level
          // This should work for any level of workgroup handling
          if ( workgroup_id.x % ${u32( workgroupSize * grainSize )} == 0u ) {
            reduction_value = ${addedValue};
          }
          else {
            reduction_value = scanned_reduction[ workgroup_id.x - 1u ];
          }
        `}
      }

      workgroupBarrier();

      ${addedValue} = reduction_value;
    `,
    addedValueNeedsWorkgroupBarrier: false,
  } )}
}
