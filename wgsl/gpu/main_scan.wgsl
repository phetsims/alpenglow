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

#import ./load_multiple
#import ./unroll
#import ./scan
#import ./coalesced_loop

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
  // Load into workgroup memory
  ${load_multiple( {
    loadExpression: index => `input[ ${index} ]`,
    storeStatements: ( index, value ) => `scratch[ ${index} ] = ${value};`,
    valueType: valueType,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: length,
    outOfRangeValue: identity,
    inputOrder: inputOrder,
    inputAccessOrder: inputAccessOrder,
    factorOutSubexpressions: factorOutSubexpressions,
  } )}

  workgroupBarrier();

  // TODO: consider factoring out local_id.x * ${u32( grainSize )}? -- it will take up an extra register?

  // TODO: isolate out into scan_sequential?
  // Sequential scan of each thread's tile (inclusive)
  var value = scratch[ local_id.x * ${u32( grainSize )} ];
  ${unroll( 1, grainSize, i => `
    {
      // TODO: we should factor out this combineExpression/combineStatements pattern, where we just want to assign it?
      ${combineExpression ? `
        value = ${combineExpression( `value`, `scratch[ local_id.x * ${u32( grainSize )} + ${u32( i )} ]` )};
      ` : `
        ${combineStatements( `value`, `value`, `scratch[ local_id.x * ${u32( grainSize )} + ${u32( i )} ]` )}
      `}

      scratch[ local_id.x * ${u32( grainSize )} + ${u32( i )} ] = value;
    }
  `)}

  // For the first scan step, since it will access other indices in scratch
  workgroupBarrier();

  // Scan the last-scanned element of each thread's tile (inclusive)
  ${scan( {
    value: `value`,
    scratch: `scratch`,
    workgroupSize: workgroupSize,
    identity: identity,
    combineExpression: combineExpression,
    combineStatements: combineStatements,
    mapScratchIndex: index => `( ${index} ) * ${u32( grainSize )} + ${u32( grainSize - 1 )}`,
    exclusive: false,
    needsValidScratch: true,

    // both `value` and the scratch value should be matching!
    scratchPreloaded: true,
    valuePreloaded: true,
  } )}

  workgroupBarrier();

  // IF exclusive and we want the full reduced value, we'd need to extract it now.

  // Add those values into all the other elements of the next tile
  let added_value = select( ${identity}, scratch[ local_id.x * ${u32( grainSize )} - 1u ], local_id.x > 0 );
  ${unroll( 0, grainSize - 1, i => `
    {
      let index = local_id.x * ${u32( grainSize )} + ${u32( i )};
      ${combineExpression ? `
        scratch[ index ] = ${combineExpression( `added_value`, `scratch[ index ]` )};
      ` : `
        var current_value = scratch[ index ];
        ${combineStatements( `current_value`, `added_value`, `current_value` )}
        scratch[ index ] = current_value;
      `}
    }
  `)}

  workgroupBarrier();

  // Write our output in a coalesced order.
  ${coalesced_loop( {
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: length,
    callback: ( localIndex, dataIndex ) => `
      output[ ${dataIndex} ] = ${exclusive ? `select( ${identity}, scratch[ ${localIndex} - 1u ], ${localIndex} > 0u )` : `scratch[ ${localIndex} ]`};
    `
  } )}
}
