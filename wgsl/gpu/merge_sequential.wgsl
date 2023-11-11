// Copyright 2023, University of Colorado Boulder

/**
 * A template that merges together two sorted arrays into a single sorted array (in a fully sequential single-thread way)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment

${template( ( {
  lengthA, // expression: u32
  lengthB, // expression: u32
  compare, // ( indexA, indexB ) => {-1, 0, 1}
  setFromA, // ( indexOutput, indexA ) => void
  setFromB, // ( indexOutput, indexB ) => void
} ) => `
  ${comment( 'begin merge_sequential' )}
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

      if ( ${compare( `ms_i`, `ms_j` )} <= 0i ) {
        ${setFromA( `ms_k`, `ms_i` )}
        ms_i++;
      }
      else {
        ${setFromB( `ms_k`, `ms_j` )}
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

      ${setFromA( `ms_k`, `ms_i` )}
      ms_i++;
      ms_k++;
    }

    // The remainder of B
    while ( ms_j < ${lengthB} ) {
      oops_count++;
      if ( oops_count > 0xffu ) {
        break;
      }

      ${setFromB( `ms_k`, `ms_j` )}
      ms_j++;
      ms_k++;
    }
  }
  ${comment( 'end merge_sequential' )}
` )}
