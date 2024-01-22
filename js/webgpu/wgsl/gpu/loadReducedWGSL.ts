// Copyright 2023-2024, University of Colorado Boulder

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

import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, commentWGSL, conditionalIfWGSL, GLOBAL_INDEXABLE_DEFAULTS, GlobalIndexable, LOCAL_INDEXABLE_DEFAULTS, LocalIndexable, OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS, OptionalLengthExpressionable, RakedSizable, u32S, unrollWGSL, wgsl, WGSLExpression, WGSLExpressionT, WGSLExpressionU32, wgslJoin, WGSLStatements, WGSLVariableName, WORKGROUP_INDEXABLE_DEFAULTS, WorkgroupIndexable } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

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
} & RakedSizable & GlobalIndexable & WorkgroupIndexable & LocalIndexable & OptionalLengthExpressionable;

export const LOAD_REDUCED_DEFAULTS = {
  loadExpression: null,
  loadStatements: null,
  inputOrder: 'blocked',
  inputAccessOrder: 'striped',
  sequentialReduceStyle: 'factored',
  useSelectIfOptional: false,
  orderOverride: false,
  ...GLOBAL_INDEXABLE_DEFAULTS, // eslint-disable-line no-object-spread-on-non-literals
  ...WORKGROUP_INDEXABLE_DEFAULTS, // eslint-disable-line no-object-spread-on-non-literals
  ...LOCAL_INDEXABLE_DEFAULTS, // eslint-disable-line no-object-spread-on-non-literals
  ...OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS // eslint-disable-line no-object-spread-on-non-literals
} as const;

const loadReducedWGSL = <T>(
  providedOptions: loadReducedWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<loadReducedWGSLOptions<T>>()( {}, LOAD_REDUCED_DEFAULTS, providedOptions );

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
      outerDeclarations.push( wgsl`let base_blocked_index = ${u32S( grainSize )} * ${globalIndex};` );
      loadDeclarations.push( i => wgsl`let blocked_index = base_blocked_index + ${u32S( i )};` ); // TODO: simplify i=0?
      loadIndexExpression = () => wgsl`blocked_index`;
      if ( lengthExpression !== null ) {
        // NOTE: only have to do the 'blocked' case, since for striped data we're not supporting blocked access order
        rangeCheckIndexExpression = loadIndexExpression;
      }
    }
    else {
      loadIndexExpression = i => wgsl`${u32S( grainSize )} * ${globalIndex} + ${u32S( i )}`; // TODO: simplify i=0?
      if ( lengthExpression !== null ) {
        // NOTE: only have to do the 'blocked' case, since for striped data we're not supporting blocked access order
        rangeCheckIndexExpression = loadIndexExpression;
      }
    }
  }
  else if ( inputAccessOrder === 'striped' ) {
    if ( sequentialReduceStyle === 'factored' ) {
      if ( inputOrder === 'striped' && lengthExpression ) {
        outerDeclarations.push( wgsl`let base_workgroup = ${workgroupIndex} * ${u32S( workgroupSize * grainSize )};` );
        outerDeclarations.push( wgsl`let base_striped_index = base_workgroup + ${localIndex};` );
        outerDeclarations.push( wgsl`let base_blocked_index = base_workgroup + ${localIndex} * ${u32S( grainSize )};` );
      }
      else {
        outerDeclarations.push( wgsl`let base_striped_index = ${workgroupIndex} * ${u32S( workgroupSize * grainSize )} + ${localIndex};` );
      }

      loadDeclarations.push( i => wgsl`let striped_index = base_striped_index + ${u32S( i * workgroupSize )};` );
      loadIndexExpression = () => wgsl`striped_index`;

      if ( lengthExpression !== null ) {
        if ( inputOrder === 'striped' ) {
          rangeCheckIndexExpression = i => wgsl`base_blocked_index + ${u32S( i )}`; // TODO: simplify i=0?
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
      loadIndexExpression = i => wgsl`${workgroupIndex} * ${u32S( workgroupSize * grainSize )} + ${localIndex} + ${u32S( i * workgroupSize )}`;
      if ( lengthExpression !== null ) {
        if ( inputOrder === 'striped' ) {
          rangeCheckIndexExpression = i => wgsl`${workgroupIndex} * ${u32S( workgroupSize * grainSize )} + ${localIndex} * ${u32S( grainSize )} + ${u32S( i )}`; // TODO: simplify i=0?
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

  // TODO: factor out length expression conditionally, since sometimes it might duplicate buffer loads(!)
  const loadWithRangeCheckExpression = ( i: number ) => rangeCheckIndexExpression
    ? wgsl`select( ${binaryOp.identityWGSL}, ${loadExpression!( loadIndexExpression!( i ) )}, ${rangeCheckIndexExpression( i )} < ${lengthExpression!} )`
    : loadExpression!( loadIndexExpression!( i ) );

  const ifRangeCheck = ( i: number, trueStatements: WGSLStatements, falseStatements: WGSLStatements | null = null ) => {
    return conditionalIfWGSL( rangeCheckIndexExpression ? wgsl`${rangeCheckIndexExpression( i )} < ${lengthExpression!}` : null, trueStatements, falseStatements );
  };

  const indexedLoadStatements = ( varName: WGSLVariableName, i: number, declaration?: WGSLStatements ) => loadExpression ? wgsl`
    ${declaration ? wgsl`${declaration} ` : wgsl``}${varName} = ${loadExpression( loadIndexExpression!( i ) )};
  ` : wgsl`
    ${declaration ? wgsl`
      var ${varName}: ${binaryOp.type.valueType};
    ` : wgsl``}
    ${loadStatements!( varName, loadIndexExpression!( i ) )}
  `;

  const loadWithRangeCheckStatements = ( varName: WGSLVariableName, i: number ) => ifRangeCheck( i, wgsl`
    ${indexedLoadStatements( varName, i )}
  `, wgsl`
    ${varName} = ${binaryOp.identityWGSL};
  ` );

  const getNestedExpression = ( i: number ): WGSLExpression => {
    return i === 0 ? loadWithRangeCheckExpression( 0 ) : binaryOp.combineExpression!( getNestedExpression( i - 1 ), loadWithRangeCheckExpression( i ) );
  };

  const combineToValue = ( varName: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => {
    return binaryExpressionStatementWGSL( varName, binaryOp.combineExpression || null, binaryOp.combineStatements || null, a, b );
  };

  // TODO: more unique names to prevent namespace collision!
  return sequentialReduceStyle === 'nested' ? wgsl`
    var ${value} = ${getNestedExpression( grainSize - 1 )};
  ` : wgsl`
    ${commentWGSL( 'begin load_reduced' )}
    var ${value}: ${binaryOp.type.valueType};
    {
      ${wgslJoin( '\n', outerDeclarations )}
      {
        ${wgslJoin( '\n', loadDeclarations.map( declaration => declaration( 0 ) ) )}
        ${( loadExpression && useSelectIfOptional ) ? wgsl`
          ${value} = ${loadWithRangeCheckExpression( 0 )};
        ` : wgsl`
          ${loadWithRangeCheckStatements( value, 0 )}
        `}
      }
      ${unrollWGSL( 1, grainSize, i => wgsl`
        {
          ${wgslJoin( '\n', loadDeclarations.map( declaration => declaration( i ) ) )}
          ${( loadExpression && useSelectIfOptional ) ? wgsl`
            ${combineToValue( value, value, loadWithRangeCheckExpression( i ) )}
          ` : wgsl`
            ${ifRangeCheck( i, wgsl`
              ${indexedLoadStatements( wgsl`next_value`, i, wgsl`let` )}
              ${combineToValue( value, value, wgsl`next_value` )}
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
