// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  value,
  scratch,
  workgroupSize,
  combine,
  skipLastScratch = false
} ) => `
  ${scratch}[ local_id.x ] = ${value};

  ${unroll( 0, Math.log2( workgroupSize ), ( i, isFirst, isLast ) => `
    workgroupBarrier();

    if ( local_id.x < ${u32( workgroupSize - ( 1 << i ) )} ) {
      ${value} = ${combine( value, `${scratch}[ local_id.x + ${u32( 1 << i )} ]` )};
    }

    ${ isLast && skipLastScratch ? `` : `
      workgroupBarrier();

      ${scratch}[ local_id.x ] = ${value};
    `}
  ` )}
` )}
