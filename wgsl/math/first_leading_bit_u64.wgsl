// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64

// NOTE: ASSUMES NONZERO
fn first_leading_bit_u64( a: u64 ) -> u32 {
  if ( a.y != 0u ) {
    return firstLeadingBit( a.y ) + 32u;
  }
  else {
    return firstLeadingBit( a.x );
  }
}
