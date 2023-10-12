// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#option ExtendPad
#option ExtendReflect
#option ExtendRepeat

fn extend_f32( t: f32, extend: u32 ) -> f32 {
  switch ( extend ) {
    case ${u32( ExtendPad )}: {
      return clamp( t, 0f, 1f );
    }
    case ${u32( ExtendRepeat )}: {
      return fract( t );
    }
    case ${u32( ExtendReflect )}: {
      return abs( t - 2f * round( 0.5f * t ) );
    }
    default: {
      return t;
    }
  }
}
