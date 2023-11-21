// Copyright 2023, University of Colorado Boulder

/**
 * Provides the ability to log things to a buffer in storage, like console.log would.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#option log

${template( ( code ) => {
  if ( !log ) {
    return '';
  }
  else {
    return code;
  }
} )}
