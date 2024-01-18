// Copyright 2023, University of Colorado Boulder

// @author Jonathan Olson <jonathan.olson@colorado.edu>

const citationData = citations; // eslint-disable-line no-undef

document.querySelector( '#references-container' ).innerHTML = citationData.bibliography;

document.querySelectorAll( '.citation' ).forEach( citation => {
  const id = citation.getAttribute( 'data-citation-id' );
  const data = citationData.map[ id ];
  if ( data ) {
    const citationText = data.citation;
    // const citationLink = data.link;

    citation.innerHTML = `<a href="#reference-${id}">${citationText}</a>`;
  }
  else {
    throw new Error( 'missing citation' );
  }
} );