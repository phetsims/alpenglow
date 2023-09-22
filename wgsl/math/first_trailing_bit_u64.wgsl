// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64

// NOTE: ASSUMES NONZERO
fn first_trailing_bit_u64( a: u64 ) -> u32 {
  if ( a.x != 0u ) {
    return firstTrailingBit( a.x );
  }
  else {
    return firstTrailingBit( a.y ) + 32u;
  }
}
