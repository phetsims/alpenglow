// Copyright 2023, University of Colorado Boulder

/**
 * All of the needed logic for a raked workgroup scan (including the logic to load and store the data).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./load_multiple
#import ./scan_raked
#import ./coalesced_loop

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

    ${scan_raked( {
      scratch: scratch,
      valueType: valueType,
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      identity: identity,
      combineExpression: combineExpression,
      combineStatements: combineStatements,
      storeReduction: storeReduction,
      stripeReducedOutput: stripeReducedOutput,
      exclusive: exclusive,
      getAddedValue: getAddedValue,
      addedValueNeedsWorkgroupBarrier: addedValueNeedsWorkgroupBarrier,
    } )}

    workgroupBarrier();

    // Write our output in a coalesced order.
    ${comment( 'begin (output write)' )}
    ${coalesced_loop( {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      length: length,
      callback: ( localIndex, dataIndex ) => `
        ${output}[ ${dataIndex} ] = ${exclusive ? `select( ${getAddedValue ? `workgroup_added_value` : identity}, ${scratch}[ ${localIndex} - 1u ], ${localIndex} > 0u )` : `${scratch}[ ${localIndex} ]`};
      `
    } )}
    ${comment( 'end (output write)' )}

    ${comment( 'end scan_comprehensive' )}
  `;
} )}
