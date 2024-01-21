// Copyright 2023, University of Colorado Boulder

/**
 * A template that merges together two sorted arrays into a single sorted array (in a fully sequential single-thread way)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, commentWGSL, PipelineBlueprint, WGSLExpressionI32, WGSLExpressionU32, WGSLStatements } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type mergeSequentialWGSLOptions = {
  lengthA: WGSLExpressionU32;
  lengthB: WGSLExpressionU32;

  // => {-1, 0, 1} (i32)
  compare: ( blueprint: PipelineBlueprint, indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionI32;

  setFromA: ( blueprint: PipelineBlueprint, indexOutput: WGSLExpressionU32, indexA: WGSLExpressionU32 ) => WGSLStatements;
  setFromB: ( blueprint: PipelineBlueprint, indexOutput: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLStatements;
};

export const MERGE_SEQUENTIAL_DEFAULTS = {
  greaterThan: null,
  lessThanOrEqual: null
} as const;

const mergeSequentialWGSL = (
  blueprint: PipelineBlueprint,
  providedOptions: mergeSequentialWGSLOptions
): WGSLStatements => {

  const options = optionize3<mergeSequentialWGSLOptions>()( {}, MERGE_SEQUENTIAL_DEFAULTS, providedOptions );

  const lengthA = options.lengthA;
  const lengthB = options.lengthB;
  const compare = options.compare;
  const setFromA = options.setFromA;
  const setFromB = options.setFromB;

  return `
    ${commentWGSL( 'begin merge_sequential' )}
    {
      var ms_i = 0u;
      var ms_j = 0u;
      var ms_k = 0u;
  
      // TODO: remove oops_count, also if keeping, make it generally high enough
      var oops_count = 0u;
  
      // The overlap of A and B
      while ( ms_i < ${lengthA} && ms_j < ${lengthB} ) {
        oops_count++;
        if ( oops_count > 0xffu ) {
          break;
        }
  
        if ( ${compare( blueprint, 'ms_i', 'ms_j' )} <= 0i ) {
          ${setFromA( blueprint, 'ms_k', 'ms_i' )}
          ms_i++;
        }
        else {
          ${setFromB( blueprint, 'ms_k', 'ms_j' )}
          ms_j++;
        }
        ms_k++;
      }
  
      // The remainder of A
      while ( ms_i < ${lengthA} ) {
        oops_count++;
        if ( oops_count > 0xffu ) {
          break;
        }
  
        ${setFromA( blueprint, 'ms_k', 'ms_i' )}
        ms_i++;
        ms_k++;
      }
  
      // The remainder of B
      while ( ms_j < ${lengthB} ) {
        oops_count++;
        if ( oops_count > 0xffu ) {
          break;
        }
  
        ${setFromB( blueprint, 'ms_k', 'ms_j' )}
        ms_j++;
        ms_k++;
      }
    }
    ${commentWGSL( 'end merge_sequential' )}
  `;
};

export default mergeSequentialWGSL;

alpenglow.register( 'mergeSequentialWGSL', mergeSequentialWGSL );
