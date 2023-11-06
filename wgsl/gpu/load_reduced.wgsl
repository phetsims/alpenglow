// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

// CASE: if commutative reduce, we want to load coalesced, keep striped, so we can skip extra workgroupBarriers and
//       rearranging. We'll use convergent reduce anyway
// CASE: if non-commutative reduce, we want to ... load blocked (?), reverseBits into convergent, and convergent-reduce?
// CASE: if non-commutative reduce on striped data, we want to load striped, morph into convergent, and convergent-reduce
// CASE: scan: load how the data is stored (blocked/striped), NO storeOrder, then scan.
//       TODO: what if... for exclusive prefix sums, we MIGHT want to load data one-offset?
// TODO: WE WILL WANT to store non-commutative reduce (and ALL scan) data in striped order, so we can load it efficiently

// TODO: also create load_multiple (we don't reduce things, we just load them into an array)
// TODO: once we have the orderings handled, CONDENSE THE AMOUNT OF EXAMPLES
// TODO: combine reduce.wgsl and reduce_convergent.wgsl (reduce) so we can just adjust things easily

${template( ( {
  // the "output" variable name
  value,

  // the type of the "output" variable (T) - can be omitted if nestSubexpressions is true
  valueType,

  // ( index ) => T, expression, -- wrap with parentheses as needed TODO: should we always do this to prevent errors?
  loadExpression,
  // ( varName: string, index ) => statements setting varName: T,
  loadStatements,

  // T, expression (should be the identity element of the combine operation)
  identity,

  // ( a: T, b: T ) => expr T - expression (should combine the two values) -- wrap with parentheses as needed TODO: should we always do this to prevent errors?
  combineExpression,
  // ( varName: string, a: T, b: T ) => statements setting varName: T, (should combine the two values)
  combineStatements,

  // number (the number of threads running this command)
  workgroupSize,

  // number (the number of elements each thread should process)
  grainSize,

  // expression: u32 (the global index of the thread) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  globalIndex = `global_id.x`,

  // expression: u32 (the index of the workgroup) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  workgroupIndex = `workgroup_id.x`,

  // expression: u32 (the index of the thread within the workgroup) - overrideable so we can run multiple smaller loads
  // in the same workgroup if ever desired
  localIndex = `local_id.x`,

  // ( expression: u32 ) | null - if provided, it will enable range checks (based on the inputOrder)
  length = null,

  // The actual order of the data in memory (needed for range checks, not required if range checks are disabled)
  inputOrder = null, // 'blocked' | 'striped'

  // The order of access to the input data (determines the "value" output order also)
  inputAccessOrder, // 'blocked' | 'striped'

  // Whether local variables should be used to factor out subexpressions (potentially more register usage, but less
  // computation).
  factorOutSubexpressions = true,

  // Whether to nest the combine calls, e.g. combine( combine( combine( a, b ), c ), d )
  nestSubexpressions = false,
} ) => {
  assert && assert( value );
  assert && assert( identity );
  assert && assert( workgroupSize );
  assert && assert( grainSize );
  assert && assert( nestSubexpressions || valueType, 'valueType required if not nesting subexpressions' );
  assert && assert( !length || ( inputOrder === 'blocked' || inputOrder === 'striped' ),
    'If range checks are enabled, inputOrder is required' );
  assert && assert( inputAccessOrder === 'blocked' || inputAccessOrder === 'striped' );

  assert && assert( inputOrder !== 'striped' || inputAccessOrder !== 'blocked', 'Do not use blocked order on striped data' );
  assert && assert( !nestSubexpressions || ( !factorOutSubexpressions && !combineStatements ),
    'Cannot nest and either factor out subexpressions nor have combination statements' );
  assert && assert( [ loadExpression, loadStatements ].filter( _.identity ).length === 1,
    'Must provide exactly one of loadExpression or loadStatements' );
  assert && assert( [ combineExpression, combineStatements ].filter( _.identity ).length === 1,
    'Must provide exactly one of combineExpression or combineStatements' );

  let outerDeclarations = []; // array<statement>
  let loadDeclarations = []; // array<( index: number ) => statement>
  let loadIndexExpression = null; // ( index: u32 ) => u32
  let rangeCheckIndexExpression = null;

  if ( inputAccessOrder === 'blocked' ) {
    if ( factorOutSubexpressions ) {
      outerDeclarations.push( `let base_blocked_index = ${u32( grainSize )} * ${globalIndex};` );
      loadDeclarations.push( i => `let blocked_index = base_blocked_index + ${u32( i )};` ); // TODO: simplify i=0?
      loadIndexExpression = i => `blocked_index`;
      if ( length !== null ) {
        // NOTE: only have to do the 'blocked' case, since for striped data we're not supporting blocked access order
        rangeCheckIndexExpression = loadIndexExpression;
      }
    }
    else {
      loadIndexExpression = i => `${u32( grainSize )} * ${globalIndex} + ${u32( i )}`; // TODO: simplify i=0?
      if ( length !== null ) {
        // NOTE: only have to do the 'blocked' case, since for striped data we're not supporting blocked access order
        rangeCheckIndexExpression = loadIndexExpression;
      }
    }
  }
  else if ( inputAccessOrder === 'striped' ) {
    if ( factorOutSubexpressions ) {
      if ( inputOrder === 'striped' && length ) {
        outerDeclarations.push( `let base_workgroup = ${workgroupIndex} * ${u32( workgroupSize * grainSize )};` );
        outerDeclarations.push( `let base_striped_index = base_workgroup + ${localIndex};` );
        outerDeclarations.push( `let base_blocked_index = base_workgroup + ${localIndex} * ${u32( grainSize )};` );
      }
      else {
        outerDeclarations.push( `let base_striped_index = ${workgroupIndex} * ${u32( workgroupSize * grainSize )} + ${localIndex};` );
      }

      loadDeclarations.push( i => `let striped_index = base_striped_index + ${u32( i  * workgroupSize )};` );
      loadIndexExpression = i => `striped_index`;

      if ( length !== null ) {
        if ( inputOrder === 'striped' ) {
          rangeCheckIndexExpression = i => `base_blocked_index + ${u32( i )}`; // TODO: simplify i=0?
        }
        else if ( inputOrder === 'blocked' ) {
          rangeCheckIndexExpression = loadIndexExpression;
        }
        else {
          throw new Error( `Unrecognized inputOrder: ${inputOrder}` );
        }
      }
    }
    else {
      loadIndexExpression = i => `${workgroupIndex} * ${u32( workgroupSize * grainSize )} + ${localIndex} + ${u32( i  * workgroupSize )}`;
      if ( length !== null ) {
        if ( inputOrder === 'striped' ) {
          rangeCheckIndexExpression = i => `${workgroupIndex} * ${u32( workgroupSize * grainSize )} + ${localIndex} * ${u32( grainSize )} + ${u32( i )}`; // TODO: simplify i=0?
        }
        else if ( inputOrder === 'blocked' ) {
          rangeCheckIndexExpression = loadIndexExpression;
        }
        else {
          throw new Error( `Unrecognized inputOrder: ${inputOrder}` );
        }
      }
    }
  }
  else {
    throw new Error( `Unrecognized inputAccessOrder: ${inputAccessOrder}` );
  }

  assert && assert( !rangeCheckIndexExpression === ( length === null ), 'rangeCheckIndexExpression must be created iff length is provided' );

  const loadWithRangeCheckExpression = i => rangeCheckIndexExpression
    ? `select( ${identity}, ${loadExpression( loadIndexExpression( i ) )}, ${rangeCheckIndexExpression( i )} < ${length} )`
    : loadExpression( loadIndexExpression( i ) );

  const loadWithRangeCheckStatements = ( varName, i ) => {
    if ( loadExpression ) {
      return `let ${varName} = ${loadWithRangeCheckExpression( i )};`;
    }
    else {
      if ( rangeCheckIndexExpression ) {
        return `
          var ${varName}: ${valueType};
          if ( ${rangeCheckIndexExpression( i )} < ${length} ) {
            ${loadStatements( varName, loadIndexExpression( i ) )}
          }
          else {
            ${varName} = ${identity};
          }
        `;
      }
      else {
        return `
          var ${varName}: ${valueType};
          ${loadStatements( varName, loadIndexExpression( i ) )}
        `;
      }
    }
  };

  const getNestedExpression = i => {
    return i === 0 ? loadWithRangeCheckExpression( 0 ) : combineExpression( getNestedExpression( i - 1 ), loadWithRangeCheckExpression( i ) )
  };

  // TODO: more unique names to prevent namespace collision!
  return nestSubexpressions ? `
    let ${value} = ${getNestedExpression( grainSize - 1 )};
  ` :`
    var ${value}: ${valueType};
    {
      ${outerDeclarations.join( '\n' )}
      {
        ${loadDeclarations.map( declaration => declaration( 0 ) ).join( '\n' )}
        ${loadExpression ? `
          ${value} = ${loadWithRangeCheckExpression( 0 )};
        ` : `
          ${loadWithRangeCheckStatements( `first_value`, 0 )}
          ${value} = first_value;
        `}
      }
      ${unroll( 1, grainSize, i => `
        {
          ${loadDeclarations.map( declaration => declaration( i ) ).join( '\n' )}
          ${combineExpression ? (
            loadExpression ? `
              ${value} = ${combineExpression( value, loadWithRangeCheckExpression( i ) )};
            ` : `
              ${loadWithRangeCheckStatements( `next_value`, i )}
              ${value} = ${combineExpression( value, `next_value` )};
            `
          ) : (
            loadExpression ? `
              ${combineStatements( value, value, loadWithRangeCheckExpression( i ) )}
            ` : `
              ${loadWithRangeCheckStatements( `next_value`, i )}
              ${combineStatements( value, value, `next_value` )}
            `
          ) }
        }
      ` )}
    }
  `;
} )}
