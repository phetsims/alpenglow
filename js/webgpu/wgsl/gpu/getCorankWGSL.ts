// Copyright 2023-2026, University of Colorado Boulder

/**
 * Co-rank function, that determines the indices into two arrays that would be at a given rank if they were sorted
 * together (with a binary search).
 *
 * It will return the index into the first array (A), and the index into the second array (B) would just be
 * k - result.
 *
 * See ByteEncoder.getCorank for more information.
 *
 * Somewhat adapted from "Programming Massively Parallel Processors" by Hwu, Kirk and Hajj
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import { wgsl, WGSLExpressionBool, WGSLExpressionI32, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../WGSLString.js';
import { commentWGSL } from './commentWGSL.js';

export type getCorankWGSLOptions = {
  // output name (u32)
  value: WGSLVariableName;

  outputIndex: WGSLExpressionU32;
  lengthA: WGSLExpressionU32;
  lengthB: WGSLExpressionU32;

  // TODO: can we rewrite this as a custom ORDER type?

  // => {-1, 0, 1} (i32)
  compare: ( ( indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionI32 ) | null;

  // used (sometimes) instead of compare if provided
  greaterThan?: ( ( indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionBool ) | null;
  lessThanOrEqual?: ( ( indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionBool ) | null;
};

export const GET_CORANK_DEFAULTS = {
  greaterThan: null,
  lessThanOrEqual: null
} as const;

export const getCorankWGSL = (
  providedOptions: getCorankWGSLOptions
): WGSLStatements => {

  const options = optionize3<getCorankWGSLOptions>()( {}, GET_CORANK_DEFAULTS, providedOptions );

  const value = options.value;
  const outputIndex = options.outputIndex;
  const lengthA = options.lengthA;
  const lengthB = options.lengthB;
  const compare = options.compare;
  const greaterThan = options.greaterThan;
  const lessThanOrEqual = options.lessThanOrEqual;

  assert && assert( compare || greaterThan, 'One of these should be defined' );
  assert && assert( compare || lessThanOrEqual, 'One of these should be defined' );

  return wgsl`
    // TODO: add assertions
  
    ${commentWGSL( 'begin get_corank' )}
  
    var ${value} = min( ${outputIndex}, ${lengthA} );
    {
      var gc_j = ${outputIndex} - ${value};
  
      // NOTE: Parameter order and boolean swapped here to avoid a bug in Metal
      // See i32-test.html (reports out -992 buggily, where it takes the wrong branch of the select statement)
      // Bug report is https://bugs.chromium.org/p/tint/issues/detail?id=2087 (thanks James Price!)
      var gc_i_low: u32 = select( ${outputIndex} - ${lengthB}, 0u, ${outputIndex} <= ${lengthB} );
      var gc_j_low = select( ${outputIndex} - ${lengthA}, 0u, ${outputIndex} <= ${lengthA} );
      var gc_delta: u32;
  
      // TODO: remove oops_count
      var oops_count_corank = 0u;
      while ( true ) {
        oops_count_corank++;
        if ( oops_count_corank > 0xffu ) {
          break;
        }
  
        if ( ${value} > 0u && gc_j < ${lengthB} && ${greaterThan ? greaterThan( wgsl`${value} - 1u`, wgsl`gc_j` ) : wgsl`${compare!( wgsl`${value} - 1u`, wgsl`gc_j` )} > 0i`} ) {
          gc_delta = ( ${value} - gc_i_low + 1u ) >> 1u;
          gc_j_low = gc_j;
          gc_j = gc_j + gc_delta;
          ${value} = ${value} - gc_delta;
        }
        else if ( gc_j > 0u && ${value} < ${lengthA} && ${lessThanOrEqual ? lessThanOrEqual( value, wgsl`gc_j - 1u` ) : wgsl`${compare!( value, wgsl`gc_j - 1u` )} <= 0i`} ) {
          gc_delta = ( gc_j - gc_j_low + 1u ) >> 1u;
          gc_i_low = ${value};
          ${value} = ${value} + gc_delta;
          gc_j = gc_j - gc_delta;
        }
        else {
          break;
        }
      }
    }
  
    ${commentWGSL( 'end get_corank' )}
  `;
};

alpenglow.register( 'getCorankWGSL', getCorankWGSL );