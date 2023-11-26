// Copyright 2023, University of Colorado Boulder

/**
 * Loads data (usually from main memory) with multiple values per thread, but reduces them into a single value per
 * thread. Supports multiple orders of data (both in access order and storage order).
 *
 * grainSize controls how many items are loaded per thread.
 *
 * For each thread, it will essentially load the first value, and then combine that with subsequently loaded values.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, commentWGSL, conditionalIfWGSL, u32, unrollWGSL, WGSLExpression, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

type WGSLExpressionT = WGSLExpression;

// CASE: if commutative reduce, we want to load coalesced, keep striped, so we can skip extra workgroupBarriers and
//       rearranging. We'll use convergent reduce anyway
// CASE: if non-commutative reduce, we want to ... load blocked (?), reverseBits into convergent, and convergent-reduce?
// CASE: if non-commutative reduce on striped data, we want to load striped, morph into convergent, and convergent-reduce
// CASE: scan: load how the data is stored (blocked/striped), NO storeOrder, then scan.

export type loadReducedWGSLOptions<T> = {

  // the "output" variable name
  value: WGSLVariableName;

  binaryOp: BinaryOp<T>;

  // wrap with parentheses as needed TODO: should we always do this to prevent errors?
  loadExpression?: ( ( index: WGSLExpressionU32 ) => WGSLExpressionT ) | null;
  // ( varName: string, index ) => statements setting varName: T,
  loadStatements?: ( ( varName: WGSLVariableName, index: WGSLExpressionU32 ) => WGSLStatements ) | null;

  // the number of threads running this command
  workgroupSize: number;

  // the number of elements each thread should process
  grainSize: number;

  // expression: u32 (the global index of the thread) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  globalIndex?: WGSLExpressionU32;

  // expression: u32 (the index of the workgroup) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  workgroupIndex?: WGSLExpressionU32;

  // expression: u32 (the index of the thread within the workgroup) - overrideable so we can run multiple smaller loads
  // in the same workgroup if ever desired
  localIndex?: WGSLExpressionU32;

  // if provided, it will enable range checks (based on the inputOrder)
  lengthExpression?: WGSLExpressionU32 | null;

  // The actual order of the data in memory (needed for range checks, not required if range checks are disabled)
  inputOrder?: 'blocked' | 'striped';

  // The order of access to the input data (determines the "value" output order also)
  inputAccessOrder?: 'blocked' | 'striped'; // NOTE: Not just striped, if we're using this somehow and mapping indices ourselves

  // Whether local variables should be used to factor out subexpressions (potentially more register usage, but less
  // computation), or also whether to nest the combine calls, e.g. combine( combine( combine( a, b ), c ), d )
  sequentialReduceStyle?: 'factored' | 'unfactored' | 'nested';

  useSelectIfOptional?: boolean;

  // (WARNING: only use this if you know what you are doing) If true, we will not check that the binaryOp is commutative
  // if the order does not match.
  orderOverride?: boolean;
};

const DEFAULT_OPTIONS = {
  loadExpression: null,
  loadStatements: null,
  globalIndex: 'global_id.x',
  workgroupIndex: 'workgroup_id.x',
  localIndex: 'local_id.x',
  lengthExpression: null,
  inputOrder: 'blocked',
  inputAccessOrder: 'striped',
  sequentialReduceStyle: 'factored',
  useSelectIfOptional: false,
  orderOverride: false
} as const;

const loadReducedWGSL = <T>(
  providedOptions: loadReducedWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<loadReducedWGSLOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

  const value = options.value;
  const binaryOp = options.binaryOp;
  const loadExpression = options.loadExpression;
  const loadStatements = options.loadStatements;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const globalIndex = options.globalIndex;
  const workgroupIndex = options.workgroupIndex;
  const localIndex = options.localIndex;
  const lengthExpression = options.lengthExpression;
  const inputOrder = options.inputOrder;
  const inputAccessOrder = options.inputAccessOrder;
  const sequentialReduceStyle = options.sequentialReduceStyle;
  const useSelectIfOptional = options.useSelectIfOptional;
  const orderOverride = options.orderOverride;

  assert && assert( value );
  assert && assert( workgroupSize );
  assert && assert( grainSize );
  assert && assert( !lengthExpression || ( inputOrder === 'blocked' || inputOrder === 'striped' ),
    'If range checks are enabled, inputOrder is required' );
  assert && assert( inputAccessOrder === 'blocked' || inputAccessOrder === 'striped' );

  assert && assert( inputOrder !== 'striped' || inputAccessOrder !== 'blocked', 'Do not use blocked order on striped data' );
  assert && assert( [ loadExpression, loadStatements ].filter( _.identity ).length === 1,
    'Must provide exactly one of loadExpression or loadStatements' );
  assert && assert( orderOverride || binaryOp.isCommutative || inputOrder === inputAccessOrder,
    'Unless you know what you are doing (orderOverride), cannot do an out-of-order reduce on non-commutative data' );

  const outerDeclarations: WGSLStatements[] = [];
  const loadDeclarations: ( ( i : number ) => WGSLStatements )[] = [];
  let loadIndexExpression: ( ( i : number ) => WGSLExpression ) | null = null;
  let rangeCheckIndexExpression: ( ( i : number ) => WGSLExpression ) | null = null;

  if ( inputAccessOrder === 'blocked' ) {
    if ( sequentialReduceStyle === 'factored' ) {
      outerDeclarations.push( `let base_blocked_index = ${u32( grainSize )} * ${globalIndex};` );
      loadDeclarations.push( i => `let blocked_index = base_blocked_index + ${u32( i )};` ); // TODO: simplify i=0?
      loadIndexExpression = () => 'blocked_index';
      if ( lengthExpression !== null ) {
        // NOTE: only have to do the 'blocked' case, since for striped data we're not supporting blocked access order
        rangeCheckIndexExpression = loadIndexExpression;
      }
    }
    else {
      loadIndexExpression = i => `${u32( grainSize )} * ${globalIndex} + ${u32( i )}`; // TODO: simplify i=0?
      if ( lengthExpression !== null ) {
        // NOTE: only have to do the 'blocked' case, since for striped data we're not supporting blocked access order
        rangeCheckIndexExpression = loadIndexExpression;
      }
    }
  }
  else if ( inputAccessOrder === 'striped' ) {
    if ( sequentialReduceStyle === 'factored' ) {
      if ( inputOrder === 'striped' && lengthExpression ) {
        outerDeclarations.push( `let base_workgroup = ${workgroupIndex} * ${u32( workgroupSize * grainSize )};` );
        outerDeclarations.push( `let base_striped_index = base_workgroup + ${localIndex};` );
        outerDeclarations.push( `let base_blocked_index = base_workgroup + ${localIndex} * ${u32( grainSize )};` );
      }
      else {
        outerDeclarations.push( `let base_striped_index = ${workgroupIndex} * ${u32( workgroupSize * grainSize )} + ${localIndex};` );
      }

      loadDeclarations.push( i => `let striped_index = base_striped_index + ${u32( i * workgroupSize )};` );
      loadIndexExpression = () => 'striped_index';

      if ( lengthExpression !== null ) {
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
      if ( lengthExpression !== null ) {
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

  assert && assert( !rangeCheckIndexExpression === ( lengthExpression === null ), 'rangeCheckIndexExpression must be created iff length is provided' );

  const loadWithRangeCheckExpression = ( i: number ) => rangeCheckIndexExpression
    ? `select( ${binaryOp.identityWGSL}, ${loadExpression!( loadIndexExpression!( i ) )}, ${rangeCheckIndexExpression( i )} < ${lengthExpression} )`
    : loadExpression!( loadIndexExpression!( i ) );

  const ifRangeCheck = ( i: number, trueStatements: WGSLStatements, falseStatements: WGSLStatements | null = null ) => {
    return conditionalIfWGSL( rangeCheckIndexExpression ? `${rangeCheckIndexExpression( i )} < ${lengthExpression}` : null, trueStatements, falseStatements );
  };

  const indexedLoadStatements = ( varName: WGSLVariableName, i: number, declaration?: string ) => loadExpression ? `
    ${declaration ? `${declaration} ` : ''}${varName} = ${loadExpression( loadIndexExpression!( i ) )};
  ` : `
    ${declaration ? `
      var ${varName}: ${binaryOp.type.valueType};
    ` : ''}
    ${loadStatements!( varName, loadIndexExpression!( i ) )}
  `;

  const loadWithRangeCheckStatements = ( varName: WGSLVariableName, i: number ) => ifRangeCheck( i, `
    ${indexedLoadStatements( varName, i )}
  `, `
    ${varName} = ${binaryOp.identityWGSL};
  ` );

  const getNestedExpression = ( i: number ): WGSLExpression => {
    return i === 0 ? loadWithRangeCheckExpression( 0 ) : binaryOp.combineExpression!( getNestedExpression( i - 1 ), loadWithRangeCheckExpression( i ) );
  };

  const combineToValue = ( varName: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => {
    return binaryExpressionStatementWGSL( varName, binaryOp.combineExpression || null, binaryOp.combineStatements || null, a, b );
  };

  // TODO: more unique names to prevent namespace collision!
  return sequentialReduceStyle === 'nested' ? `
    var ${value} = ${getNestedExpression( grainSize - 1 )};
  ` : `
    ${commentWGSL( 'begin load_reduced' )}
    var ${value}: ${binaryOp.type.valueType};
    {
      ${outerDeclarations.join( '\n' )}
      {
        ${loadDeclarations.map( declaration => declaration( 0 ) ).join( '\n' )}
        ${( loadExpression && useSelectIfOptional ) ? `
          ${value} = ${loadWithRangeCheckExpression( 0 )};
        ` : `
          ${loadWithRangeCheckStatements( value, 0 )}
        `}
      }
      ${unrollWGSL( 1, grainSize, i => `
        {
          ${loadDeclarations.map( declaration => declaration( i ) ).join( '\n' )}
          ${( loadExpression && useSelectIfOptional ) ? `
            ${combineToValue( value, value, loadWithRangeCheckExpression( i ) )}
          ` : `
            ${ifRangeCheck( i, `
              ${indexedLoadStatements( 'next_value', i, 'let' )}
              ${combineToValue( value, value, 'next_value' )}
            ` )}
          `}
        }
      ` )}
    }
    ${commentWGSL( 'end load_reduced' )}
  `;
};

export default loadReducedWGSL;

alpenglow.register( 'loadReducedWGSL', loadReducedWGSL );
