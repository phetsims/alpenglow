// Copyright 2023-2025, University of Colorado Boulder

/**
 * A template that merges together two sorted arrays into a single sorted array.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import { u32S, wgsl, WGSLExpressionBool, WGSLExpressionI32, WGSLExpressionU32, WGSLStatements } from '../WGSLString.js';
import { GLOBAL_INDEXABLE_DEFAULTS, GlobalIndexable, GrainSizable } from '../WGSLUtils.js';
import { commentWGSL } from './commentWGSL.js';
import { getCorankWGSL } from './getCorankWGSL.js';
import { mergeSequentialWGSL } from './mergeSequentialWGSL.js';

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
  ...GLOBAL_INDEXABLE_DEFAULTS // eslint-disable-line phet/no-object-spread-on-non-literals
} as const;

export const mergeSimpleWGSL = (
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

  // TODO: factor out lengthA/lengthB so they aren't recomputed.
  return wgsl`
    ${commentWGSL( 'begin merge_simple' )}
    {
      // TODO: don't assume a specific linear workgroup size? -- use local_invocation_index?
      let max_output = ${lengthA} + ${lengthB};
      let start_output = min( max_output, ${globalIndex} * ${u32S( grainSize )} );
      let end_output = min( max_output, start_output + ${u32S( grainSize )} );
  
      if ( start_output != end_output ) {
        ${getCorankWGSL( {
          value: wgsl`start_a`,
          outputIndex: wgsl`start_output`,
          lengthA: lengthA,
          lengthB: lengthB,
          compare: compare,
          greaterThan: greaterThan,
          lessThanOrEqual: lessThanOrEqual
        } )}
        ${getCorankWGSL( {
          value: wgsl`end_a`,
          outputIndex: wgsl`end_output`,
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
  
        ${mergeSequentialWGSL( {
          lengthA: wgsl`span_a`,
          lengthB: wgsl`span_b`,
          compare: ( indexA, indexB ) => compare( wgsl`start_a + ${indexA}`, wgsl`start_b + ${indexB}` ),
          setFromA: ( indexOutput, indexA ) => setFromA( wgsl`start_output + ${indexOutput}`, wgsl`start_a + ${indexA}` ),
          setFromB: ( indexOutput, indexB ) => setFromB( wgsl`start_output + ${indexOutput}`, wgsl`start_b + ${indexB}` )
        } )}
      }
    }
    ${commentWGSL( 'end merge_simple' )}
  `;
};

alpenglow.register( 'mergeSimpleWGSL', mergeSimpleWGSL );