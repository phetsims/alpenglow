// Copyright 2023, University of Colorado Boulder

/**
 * A template that performs a reduce operation on a single workgroup. The value will be valid at local_id.x === 0.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  value,
  scratch,
  workgroupSize,
  identity,
  combine
} ) => `
  ${scratch}[ local_id.x ] = ${value};

  ${unroll( 0, Math.log2( workgroupSize ), ( i, isFirst, isLast ) => `
    workgroupBarrier();

    // TODO: check performance differences with a select/combine?
    if ( local_id.x % ${u32( 1 << ( i + 1 ) )} == 0u ) {
      ${value} = ${combine( value, `${scratch}[ local_id.x + ${u32( 1 << i )} ]` )};

      ${ !isLast ? `
        ${scratch}[ local_id.x ] = ${value};
      ` : ``}
    }
  ` )}
` )}
