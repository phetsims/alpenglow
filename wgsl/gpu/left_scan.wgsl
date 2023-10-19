// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  value,
  scratch,
  workgroupSize,
  identity,
  combine,
  exclusive = false,
  skipLastScratch = false
} ) => `
  ${scratch}[ local_id.x ] = ${value};

  ${unroll( 0, Math.log2( workgroupSize ), ( i, isFirst, isLast ) => `
    workgroupBarrier();

    if ( local_id.x >= ${u32( 1 << i )} ) {
      ${value} = ${combine( `${scratch}[ local_id.x - ${u32( 1 << i )} ]`, value )};
    }

    ${ isLast && skipLastScratch && !exclusive ? `` : `
      workgroupBarrier();

      ${scratch}[ local_id.x ] = ${value};
    `}
  ` )}

  // TODO: consider shift at start to potentially avoid this workgroupBarrier?
  ${exclusive ? `
    workgroupBarrier();

    ${value} = select( ${identity}, ${scratch}[ local_id.x - 1u ], local_id.x > 0u );
  ` : ``}
` )}
