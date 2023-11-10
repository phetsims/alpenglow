// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc (it's one of the more important ones)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./conditional_if
#import ./unroll

${template( ( {

  // ( index: expr-u32 ) => expr-T, -- wrap with parentheses as needed TODO: should we always do this to prevent errors?
  loadExpression,
  // ( varName: string, index ) => statements setting varName: T,
  loadStatements,

  // ( index: expr-32, value: expr-T ) => void
  storeStatements,

  // the type of the variable (T)
  valueType,

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

  // T, expression - if a length is provided
  outOfRangeValue = null,

  // The actual order of the data in memory (needed for range checks, not required if range checks are disabled)
  inputOrder = null, // 'blocked' | 'striped'

  // The order of access to the input data (determines the "value" output order also)
  inputAccessOrder = 'striped', // 'blocked' | 'striped'  NOTE: Not just striped, if we're using this somehow and mapping indices ourselves

  // TODO: outputOrder, support blocked or striped (we're always putting it in the original order right now)

  // Whether local variables should be used to factor out subexpressions (potentially more register usage, but less
  // computation).
  factorOutSubexpressions = true,
} ) => {
  // TODO: factor out the range checks based on inputOrder (we're going to share that with load_reduced)

  assert && assert( length !== null || outOfRangeValue !== null );
  assert && assert( workgroupSize );
  assert && assert( grainSize );
  assert && assert( !length || ( inputOrder === 'blocked' || inputOrder === 'striped' ),
    'If range checks are enabled, inputOrder is required' );
  assert && assert( inputAccessOrder === 'blocked' || inputAccessOrder === 'striped' );

  assert && assert( inputOrder !== 'striped' || inputAccessOrder !== 'blocked', 'Do not use blocked order on striped data' );
  assert && assert( [ loadExpression, loadStatements ].filter( _.identity ).length === 1,
    'Must provide exactly one of loadExpression or loadStatements' );

  let outerDeclarations = []; // array<statement>
  let loadDeclarations = []; // array<( index: number ) => statement>
  let loadIndexExpression = null; // ( index: u32 ) => u32
  let rangeCheckIndexExpression = null;

  // TODO: can we extract a general... index-mapping iteration? Note which indices we need (e.g. for instance, base_workgroup would be useful here)
  // TODO: add outputOrder(!)
  // TODO: identity vs outOfRangeValue
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

      loadDeclarations.push( i => `let striped_index = base_striped_index + ${u32( i * workgroupSize )};` );
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
      loadIndexExpression = i => `${workgroupIndex} * ${u32( workgroupSize * grainSize )} + ${localIndex} + ${u32( i * workgroupSize )}`;
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

  const ifRangeCheck = ( i, trueStatements, falseStatements = null ) => {
    return conditional_if( rangeCheckIndexExpression ? `${rangeCheckIndexExpression( i )} < ${length}` : null, trueStatements, falseStatements );
  };

  const indexedLoadStatements = ( varName, i, declaration ) => loadExpression ? `
    ${declaration ? `${declaration} ` : ``}${varName} = ${loadExpression( loadIndexExpression( i ) )};
  ` : `
    ${declaration ? `
      var ${varName}: ${valueType};
    ` : ``}
    ${loadStatements( varName, loadIndexExpression( i ) )}
  `;

  const loadWithRangeCheckStatements = ( varName, i ) => ifRangeCheck( i, `
    ${indexedLoadStatements( varName, i )}
  `, `
    ${varName} = ${outOfRangeValue};
  ` );

  // TODO: more unique names to prevent namespace collision!
  return `
    {
      ${outerDeclarations.join( '\n' )}
      ${unroll( 0, grainSize, i => `
        {
          ${loadDeclarations.map( declaration => declaration( i ) ).join( '\n' )}

          var lm_val: ${valueType};
          ${loadWithRangeCheckStatements( `lm_val`, i )}

          // TODO: can we further simplify?
          ${storeStatements( `${loadIndexExpression( i )} - ${workgroupIndex} * ${u32( workgroupSize * grainSize )}`, `lm_val` )}
        }
      ` )}
    }
  `;
} )}
