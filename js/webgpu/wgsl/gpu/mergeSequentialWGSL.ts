// Copyright 2023-2025, University of Colorado Boulder

/**
 * A template that merges together two sorted arrays into a single sorted array (in a fully sequential single-thread way)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import { wgsl, WGSLExpressionI32, WGSLExpressionU32, WGSLStatements } from '../WGSLString.js';
import { commentWGSL } from './commentWGSL.js';

export type mergeSequentialWGSLOptions = {
  lengthA: WGSLExpressionU32;
  lengthB: WGSLExpressionU32;

  // => {-1, 0, 1} (i32)
  compare: ( indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionI32;

  setFromA: ( indexOutput: WGSLExpressionU32, indexA: WGSLExpressionU32 ) => WGSLStatements;
  setFromB: ( indexOutput: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLStatements;
};

export const MERGE_SEQUENTIAL_DEFAULTS = {
  greaterThan: null,
  lessThanOrEqual: null
} as const;

export const mergeSequentialWGSL = (
  providedOptions: mergeSequentialWGSLOptions
): WGSLStatements => {

  const options = optionize3<mergeSequentialWGSLOptions>()( {}, MERGE_SEQUENTIAL_DEFAULTS, providedOptions );

  const lengthA = options.lengthA;
  const lengthB = options.lengthB;
  const compare = options.compare;
  const setFromA = options.setFromA;
  const setFromB = options.setFromB;

  return wgsl`
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
  
        if ( ${compare( wgsl`ms_i`, wgsl`ms_j` )} <= 0i ) {
          ${setFromA( wgsl`ms_k`, wgsl`ms_i` )}
          ms_i++;
        }
        else {
          ${setFromB( wgsl`ms_k`, wgsl`ms_j` )}
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
  
        ${setFromA( wgsl`ms_k`, wgsl`ms_i` )}
        ms_i++;
        ms_k++;
      }
  
      // The remainder of B
      while ( ms_j < ${lengthB} ) {
        oops_count++;
        if ( oops_count > 0xffu ) {
          break;
        }
  
        ${setFromB( wgsl`ms_k`, wgsl`ms_j` )}
        ms_j++;
        ms_k++;
      }
    }
    ${commentWGSL( 'end merge_sequential' )}
  `;
};

alpenglow.register( 'mergeSequentialWGSL', mergeSequentialWGSL );