// Copyright 2023, University of Colorado Boulder

/**
 * A template that merges together two sorted arrays into a single sorted array.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, commentWGSL, getCorankWGSL, GLOBAL_INDEXABLE_DEFAULTS, GlobalIndexable, GrainSizable, mergeSequentialWGSL, u32, WGSLContext, WGSLExpressionBool, WGSLExpressionI32, WGSLExpressionU32, WGSLStatements } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type mergeSimpleWGSLOptions = {
  lengthA: WGSLExpressionU32;
  lengthB: WGSLExpressionU32;

  // => {-1, 0, 1} (i32)
  compare: ( indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionI32;

  // used (sometimes) instead of compare if provided
  greaterThan?: ( ( indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionBool ) | null;
  lessThanOrEqual?: ( ( indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionBool ) | null;

  setFromA: ( indexOutput: WGSLExpressionU32, indexA: WGSLExpressionU32 ) => WGSLStatements;
  setFromB: ( indexOutput: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLStatements;
} & GrainSizable & GlobalIndexable;

export const MERGE_SIMPLE_DEFAULTS = {
  greaterThan: null,
  lessThanOrEqual: null,
  ...GLOBAL_INDEXABLE_DEFAULTS // eslint-disable-line no-object-spread-on-non-literals
} as const;

const mergeSimpleWGSL = (
  context: WGSLContext,
  providedOptions: mergeSimpleWGSLOptions
): WGSLStatements => {

  const options = optionize3<mergeSimpleWGSLOptions>()( {}, MERGE_SIMPLE_DEFAULTS, providedOptions );

  const lengthA = options.lengthA;
  const lengthB = options.lengthB;
  const compare = options.compare;
  const greaterThan = options.greaterThan;
  const lessThanOrEqual = options.lessThanOrEqual;
  const setFromA = options.setFromA;
  const setFromB = options.setFromB;
  const grainSize = options.grainSize;
  const globalIndex = options.globalIndex;

  return `
    ${commentWGSL( 'begin merge_simple' )}
    {
      // TODO: don't assume a specific linear workgroup size? -- use local_invocation_index?
      let max_output = ${lengthA} + ${lengthB};
      let start_output = min( max_output, ${globalIndex} * ${u32( grainSize )} );
      let end_output = min( max_output, start_output + ${u32( grainSize )} );
  
      if ( start_output != end_output ) {
        ${getCorankWGSL( context, {
          value: 'start_a',
          outputIndex: 'start_output',
          lengthA: lengthA,
          lengthB: lengthB,
          compare: compare,
          greaterThan: greaterThan,
          lessThanOrEqual: lessThanOrEqual
        } )}
        ${getCorankWGSL( context, {
          value: 'end_a',
          outputIndex: 'end_output',
          lengthA: lengthA,
          lengthB: lengthB,
          compare: compare,
          greaterThan: greaterThan,
          lessThanOrEqual: lessThanOrEqual
        } )}
  
        let start_b = start_output - start_a;
        let end_b = end_output - end_a;
  
        let span_a = end_a - start_a;
        let span_b = end_b - start_b;
  
        ${mergeSequentialWGSL( context, {
          lengthA: 'span_a',
          lengthB: 'span_b',
          compare: ( indexA, indexB ) => compare( `start_a + ${indexA}`, `start_b + ${indexB}` ),
          setFromA: ( indexOutput, indexA ) => setFromA( `start_output + ${indexOutput}`, `start_a + ${indexA}` ),
          setFromB: ( indexOutput, indexB ) => setFromB( `start_output + ${indexOutput}`, `start_b + ${indexB}` )
        } )}
      }
    }
    ${commentWGSL( 'end merge_simple' )}
  `;
};

export default mergeSimpleWGSL;

alpenglow.register( 'mergeSimpleWGSL', mergeSimpleWGSL );
