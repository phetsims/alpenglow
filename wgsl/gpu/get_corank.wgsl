// Copyright 2023, University of Colorado Boulder

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
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment

${template( ( {
  value, // output name
  outputIndex, // expression: u32
  lengthA, // expression: u32
  lengthB, // expression: u32
  compare, // ( indexA, indexB ) => {-1, 0, 1} --- takes expressions (not just names)
  greaterThan, // ( indexA, indexB ) => bool --- used instead of compare if provided
  lessThanOrEqual // ( indexA, indexB ) => bool --- used instead of compare if provided
} ) => `
  // TODO: add assertions

  ${comment( 'begin get_corank' )}

  var ${value} = min( ${outputIndex}, ${lengthA} );
  {
    var gc_j = ${outputIndex} - ${value};

    // NOTE: Parameter order and boolean swapped here to avoid a bug in Metal
    // See i32-test.html (reports out -992 buggily, where it takes the wrong branch of the select statement), or
    // buggy_merge.wgsl.
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

      if ( ${value} > 0u && gc_j < ${lengthB} && ${greaterThan ? greaterThan( `${value} - 1u`, `gc_j` ) : `${compare( `${value} - 1u`, `gc_j` )} > 0i`} ) {
        gc_delta = ( ${value} - gc_i_low + 1u ) >> 1u;
        gc_j_low = gc_j;
        gc_j = gc_j + gc_delta;
        ${value} = ${value} - gc_delta;
      }
      else if ( gc_j > 0u && ${value} < ${lengthA} && ${lessThanOrEqual ? lessThanOrEqual( value, `gc_j - 1u` ) : `${compare( value, `gc_j - 1u` )} <= 0i`} ) {
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

  ${comment( 'end get_corank' )}
` )}
