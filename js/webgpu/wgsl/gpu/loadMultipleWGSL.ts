// Copyright 2023-2024, University of Colorado Boulder

/**
 * Loads data (usually from main memory) with multiple values per thread, storing them typically in shared memory.
 * Notably supports larger sizes than the workgroup size.
 *
 * grainSize controls how many items are loaded per thread.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, commentWGSL, ConcreteType, conditionalIfWGSL, GLOBAL_INDEXABLE_DEFAULTS, GlobalIndexable, LOCAL_INDEXABLE_DEFAULTS, LocalIndexable, OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS, OptionalLengthExpressionable, RakedSizable, u32S, unrollWGSL, wgsl, WGSLExpression, WGSLExpressionT, WGSLExpressionU32, wgslJoin, WGSLStatements, WGSLString, WGSLVariableName, WORKGROUP_INDEXABLE_DEFAULTS, WorkgroupIndexable } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type loadMultipleWGSLOptions<T> = {

  // wrap with parentheses as needed TODO: should we always do this to prevent errors?
  loadExpression?: ( ( index: WGSLExpressionU32 ) => WGSLExpressionT ) | null;
  // ( varName: string, index ) => statements setting varName: T,
  loadStatements?: ( ( varName: WGSLVariableName, index: WGSLExpressionU32 ) => WGSLStatements ) | null;

  storeStatements: ( index: WGSLExpressionU32, value: WGSLExpressionT ) => WGSLStatements;

  type: ConcreteType<T>;

  // if a length is provided, used to map things out-of-range
  outOfRangeValue?: WGSLExpressionT | null;

  // The actual order of the data in memory (needed for range checks, not required if range checks are disabled)
  inputOrder: 'blocked' | 'striped';

  // The order of access to the input data (determines the "value" output order also)
  inputAccessOrder?: 'blocked' | 'striped'; // NOTE: Not just striped, if we're using this somehow and mapping indices ourselves

  // TODO: outputOrder, support blocked or striped (we're always putting it in the original order right now)

  // Whether local variables should be used to factor out subexpressions (potentially more register usage, but less
  // computation).
  factorOutSubexpressions?: boolean;
} & RakedSizable & GlobalIndexable & WorkgroupIndexable & LocalIndexable & OptionalLengthExpressionable;

export const LOAD_MULTIPLE_DEFAULTS = {
  loadExpression: null,
  loadStatements: null,
  outOfRangeValue: null,
  inputAccessOrder: 'striped',
  factorOutSubexpressions: true,
  ...GLOBAL_INDEXABLE_DEFAULTS, // eslint-disable-line phet/no-object-spread-on-non-literals
  ...WORKGROUP_INDEXABLE_DEFAULTS, // eslint-disable-line phet/no-object-spread-on-non-literals
  ...LOCAL_INDEXABLE_DEFAULTS, // eslint-disable-line phet/no-object-spread-on-non-literals
  ...OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS // eslint-disable-line phet/no-object-spread-on-non-literals
} as const;

const loadMultipleWGSL = <T>(
  providedOptions: loadMultipleWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<loadMultipleWGSLOptions<T>>()( {}, LOAD_MULTIPLE_DEFAULTS, providedOptions );

  const loadExpression = options.loadExpression;
  const loadStatements = options.loadStatements;
  const storeStatements = options.storeStatements;
  const type = options.type;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const globalIndex = options.globalIndex;
  const workgroupIndex = options.workgroupIndex;
  const localIndex = options.localIndex;
  const lengthExpression = options.lengthExpression;
  const outOfRangeValue = options.outOfRangeValue;
  const inputOrder = options.inputOrder;
  const inputAccessOrder = options.inputAccessOrder;
  const factorOutSubexpressions = options.factorOutSubexpressions;

  // TODO: factor out the range checks based on inputOrder (we're going to share that with load_reduced)

  assert && assert( lengthExpression !== null || outOfRangeValue !== null );
  assert && assert( workgroupSize );
  assert && assert( grainSize );
  assert && assert( !lengthExpression || ( inputOrder === 'blocked' || inputOrder === 'striped' ),
    'If range checks are enabled, inputOrder is required' );
  assert && assert( inputAccessOrder === 'blocked' || inputAccessOrder === 'striped' );

  assert && assert( inputOrder !== 'striped' || inputAccessOrder !== 'blocked', 'Do not use blocked order on striped data' );
  assert && assert( [ loadExpression, loadStatements ].filter( _.identity ).length === 1,
    'Must provide exactly one of loadExpression or loadStatements' );

  const outerDeclarations: WGSLStatements[] = [];
  const loadDeclarations: ( ( i: number ) => WGSLStatements )[] = [];
  let loadIndexExpression: ( ( i: number ) => WGSLExpression ) | null = null;
  let rangeCheckIndexExpression: ( ( i: number ) => WGSLExpression ) | null = null;

  // TODO: can we extract a general... index-mapping iteration? Note which indices we need (e.g. for instance, base_workgroup would be useful here)
  // TODO: add outputOrder(!)
  // TODO: identity vs outOfRangeValue
  if ( inputAccessOrder === 'blocked' ) {
    if ( factorOutSubexpressions ) {
      outerDeclarations.push( wgsl`let base_blocked_index = ${u32S( grainSize )} * ${globalIndex};` );
      loadDeclarations.push( i => wgsl`let blocked_index = base_blocked_index + ${u32S( i )};` ); // TODO: simplify i=0?
      loadIndexExpression = i => wgsl`blocked_index`;
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
    if ( factorOutSubexpressions ) {
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

  const ifRangeCheck = ( i: number, trueStatements: WGSLStatements, falseStatements: WGSLStatements | null = null ) => {
    return conditionalIfWGSL( rangeCheckIndexExpression ? wgsl`${rangeCheckIndexExpression( i )} < ${lengthExpression!}` : null, trueStatements, falseStatements );
  };

  const indexedLoadStatements = ( varName: WGSLVariableName, i: number, declaration?: WGSLString ) => loadExpression ? wgsl`
    ${declaration ? wgsl`${declaration} ` : wgsl``}${varName} = ${loadExpression( loadIndexExpression( i ) )};
  ` : wgsl`
    ${declaration ? wgsl`
      var ${varName}: ${type.valueType};
    ` : wgsl``}
    ${loadStatements!( varName, loadIndexExpression( i ) )}
  `;

  // TODO: more unique names to prevent namespace collision!
  return wgsl`
    ${commentWGSL( 'begin load_multiple' )}
    {
      ${wgslJoin( '\n', outerDeclarations )}
      ${unrollWGSL( 0, grainSize, i => wgsl`
        {
          ${wgslJoin( '\n', loadDeclarations.map( declaration => declaration( i ) ) )}

          ${outOfRangeValue ? wgsl`
            var lm_val: ${type.valueType};
            ${ifRangeCheck( i, wgsl`
              ${indexedLoadStatements( wgsl`lm_val`, i )}
            `, wgsl`
              lm_val = ${outOfRangeValue};
            ` )}

            // TODO: can we further simplify?
            ${storeStatements( wgsl`${loadIndexExpression( i )} - ${workgroupIndex} * ${u32S( workgroupSize * grainSize )}`, wgsl`lm_val` )}
          ` : wgsl`
            ${ifRangeCheck( i, wgsl`
              var lm_val: ${type.valueType};
              ${indexedLoadStatements( wgsl`lm_val`, i )}

              ${storeStatements( wgsl`${loadIndexExpression( i )} - ${workgroupIndex} * ${u32S( workgroupSize * grainSize )}`, wgsl`lm_val` )}
            ` )}
          `}
        }
      ` )}
    }
    ${commentWGSL( 'end load_multiple' )}
  `;
};

export default loadMultipleWGSL;

alpenglow.register( 'loadMultipleWGSL', loadMultipleWGSL );