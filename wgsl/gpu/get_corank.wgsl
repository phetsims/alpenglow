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
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

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

  var ${value} = min( ${outputIndex}, ${lengthA} );
  {
    var gc_j = ${outputIndex} - ${value};
    var gc_i_low: u32 = select( 0u, ${outputIndex} - ${lengthB}, ${outputIndex} > ${lengthB} );
    var gc_j_low = select( 0u, ${outputIndex} - ${lengthA}, ${outputIndex} > ${lengthA} );
    var gc_delta: u32;

    // TODO: remove oops_count
    var oops_count = 0u;
    while ( true ) {
      oops_count++;
      if ( oops_count > 0xffu ) {
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
` )}
