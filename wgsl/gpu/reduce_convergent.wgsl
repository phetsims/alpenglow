// Copyright 2023, University of Colorado Boulder

/**
 * A template that performs a reduce operation on a single workgroup. The value will be valid at local_id.x === 0.
 *
 * This version will use a convergent order, that reduces control divergence. Either the operation should be commutative,
 * or the order should be inversed based on bits, e.g. the order of reduction of 16 elements in hex would be:
 * 084c2a6e195d3b7f. Thus for 2^n, the index should have its bits reversed.
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

  ${unroll( Math.log2( workgroupSize ), 0, ( i, isFirst, isLast ) => `
    workgroupBarrier();

    // TODO: check performance differences with a select/combine?
    if ( local_id.x < ${u32( 1 << ( i - 1 ) )} ) {
      ${value} = ${combine( value, `${scratch}[ local_id.x + ${u32( 1 << ( i - 1 ) )} ]` )};

      ${ !isLast ? `
        ${scratch}[ local_id.x ] = ${value};
      ` : ``}
    }
  ` )}
` )}
