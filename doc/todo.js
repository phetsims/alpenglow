// Copyright 2023, University of Colorado Boulder

// @author Jonathan Olson <jonathan.olson@colorado.edu>

// Hides TODOs unless a query parameter (?TODO) is present

( () => {
  const urlParams = new URLSearchParams( window.location.search );
  const showTODOs = urlParams.get( 'TODO' ) !== null;
  if ( showTODOs ) {
    const style = document.createElement( 'style' );
    style.type = 'text/css';
    style.innerHTML = `
      .TODO {
        display: inherit !important;
      }
      .DEFERRED {
        display: inherit !important;
      }
    `;
    document.getElementsByTagName( 'head' )[ 0 ].appendChild( style );
  }
} )();