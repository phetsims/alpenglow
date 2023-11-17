// Copyright 2023, University of Colorado Boulder

/**
 * All of the needed logic for a raked workgroup scan (including the logic to load and store the data).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./load_multiple
#import ./unroll
#import ./scan
#import ./coalesced_loop
#import ./binary_expression_statement
#import ./to_striped_index

${template( ( {
  // varname of input var<storage> array<{valueType}>
  input,

  // varname of output var<storage> array<{valueType}> (can be the same as the input)
  output,

  // varname of output var<workgroup> array<${valueType}, ${workgroupSize * grainSize}>
  scratch,

  // the type of the "output" variable (T) - can be omitted if nestSubexpressions is true
  valueType,

  // number (the number of threads running this command)
  workgroupSize,

  // number (the number of elements each thread should process)
  grainSize,

  // T, expression (should be the identity element of the combine operation)
  identity,

  // ( a: T, b: T ) => expr T - expression (should combine the two values) -- wrap with parentheses as needed TODO: should we always do this to prevent errors?
  combineExpression,
  // ( varName: string, a: T, b: T ) => statements setting varName: T, (should combine the two values)
  combineStatements,

  // null | ( index expr, expr: T ) => statements - Stores out the "fully reduced" value
  storeReduction = null,
  stripeReducedOutput = false,

  // ( expression: u32 ) | null - if provided, it will enable range checks (based on the inputOrder)
  length = null,

  // The actual order of the data in memory (needed for range checks, not required if range checks are disabled)
  inputOrder = null, // 'blocked' | 'striped'

  // The order of access to the input data (determines the "value" output order also)
  inputAccessOrder, // 'blocked' | 'striped'

  // Whether local variables should be used to factor out subexpressions (potentially more register usage, but less
  // computation).
  factorOutSubexpressions = true,

  // Whether the scan should be exclusive (the first element is the identity element) or inclusive (the first element
  // is the first element of the input)
  exclusive = false,

  // null | ( varName ) => statements - should write a value to be added to everything into the specific variable name
  // This is designed to be used for multi-level scans, where you essentially want to add an "offset" value to
  // everything in the workgroup.
  getAddedValue = null,

  // We can opt out of the extra workgroupBarrier if getAddedValue executes one itself (say, for atomics).
  addedValueNeedsWorkgroupBarrier = true,
} ) => {
  const combineToValue = ( varName, a, b ) => binary_expression_statement( varName, combineExpression, combineStatements, a, b );

  return `
    ${comment( 'begin scan_comprehensive' )}

    // Load into workgroup memory
    ${load_multiple( {
      loadExpression: index => `${input}[ ${index} ]`,
      storeStatements: ( index, value ) => `${scratch}[ ${index} ] = ${value};`,
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
    var value = ${scratch}[ local_id.x * ${u32( grainSize )} ];
    ${unroll( 1, grainSize, i => `
      {
        ${combineToValue( `value`, `value`, `${scratch}[ local_id.x * ${u32( grainSize )} + ${u32( i )} ]` )}
        ${scratch}[ local_id.x * ${u32( grainSize )} + ${u32( i )} ] = value;
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
    // TODO: we'll need to change indices if we allow right-scans(!)
    ${storeReduction ? `
      if ( local_id.x == ${u32( workgroupSize - 1 )} ) {
        ${storeReduction(
          stripeReducedOutput ? to_striped_index( {
            i: `workgroup_id.x`,
            workgroupSize: workgroupSize,
            grainSize: grainSize
          } ) : `workgroup_id.x`,
          `value`
        )}
      }
    ` : ``}

    // Add those values into all the other elements of the next tile
    var added_value = select( ${identity}, ${scratch}[ local_id.x * ${u32( grainSize )} - 1u ], local_id.x > 0 );
    ${getAddedValue ? `

      // Get the value we'll add to everything
      var workgroup_added_value: ${valueType};
      ${getAddedValue( `workgroup_added_value` )}

      // We need to LOAD the value before anything writes to it, since we'll be modifying those values
      ${addedValueNeedsWorkgroupBarrier ? `
        workgroupBarrier();
      ` : ``}

      // Update the last element of this tile (which would otherwise go untouched)
      {
        let last_value = ${scratch}[ local_id.x * ${u32( grainSize )} + ${u32( grainSize - 1 )} ];

        var new_last_value: ${valueType};
        ${combineToValue( `new_last_value`, `workgroup_added_value`, `last_value` )}

        ${scratch}[ local_id.x * ${u32( grainSize )} + ${u32( grainSize - 1 )} ] = new_last_value;
      }

      // Add the value to what we'll add to everything else
      ${combineToValue( `added_value`, `workgroup_added_value`, `added_value` )}
    ` : `
    `}
    ${unroll( 0, grainSize - 1, i => `
      {
        let index = local_id.x * ${u32( grainSize )} + ${u32( i )};
        var current_value: ${valueType};
        ${combineToValue( `current_value`, `added_value`, `${scratch}[ index ]` )}
        ${scratch}[ index ] = current_value;
      }
    `)}

    workgroupBarrier();

    // Write our output in a coalesced order.
    ${coalesced_loop( {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      length: length,
      callback: ( localIndex, dataIndex ) => `
        ${output}[ ${dataIndex} ] = ${exclusive ? `select( ${getAddedValue ? `workgroup_added_value` : identity}, ${scratch}[ ${localIndex} - 1u ], ${localIndex} > 0u )` : `${scratch}[ ${localIndex} ]`};
      `
    } )}

    ${comment( 'end scan_comprehensive' )}
  `;
} )}
