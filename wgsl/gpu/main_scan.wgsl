// Copyright 2023, University of Colorado Boulder

/**
 * A raked scan implementation capable of non-commutable cases, where:
 *
 * 1. All threads load state into workgroup memory in a coalesced fashion
 * 2. All threads perform an inclusive sequential scan on their data (of grainSize elements)
 * 3. All threads perform an inclusive scan of the "reuced" values for each thread (Hillis-Steele)
 * 4. The remaining values are filled in with the previous scanned value.workgroup
 * 5. The workgroup memory is written to the main output in a coalesced fashion
 *
 * Based on the described coarsened scan in "Programming Massively Parallel Processors" by Hwu, Kirk and Hajj, chap11.
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
  ${scan_comprehensive( {
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
  } )}
}
