// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./load_multiple
#import ./unroll
#import ./scan
#import ./coalesced_loop

${template( ( {
  // varname of input var<storage> array<{valueType}>
  input,

  // varname of output var<storage> array<{valueType}> (can be the same as the input)
  output,

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
} ) => {
  return `
    ${comment( 'begin scan_comprehensive' )}

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

    ${comment( 'end scan_comprehensive' )}
  `;
} )}
