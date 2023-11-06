// Copyright 2023, University of Colorado Boulder

/**
 * A template that performs a reduce operation on a single workgroup. The value will be valid at local_id.x === 0.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  // the "input" and "output" variable name
  value,

  // null | type T, only needed if we use combine statements
  valueType = null,

  // name for var<workgroup> array<T, workgroupSize> TODO: consider abstracting, so we could run multiple reduces
  // TODO: concurrently
  scratch,

  // number
  workgroupSize,

  // T, expression (should be the identity element of the combine operation)
  identity,

  // ( a: T, b: T ) => expr T - expression (should combine the two values) -- wrap with parentheses as needed TODO: should we always do this to prevent errors?
  combineExpression,
  // ( varName: string, a: T, b: T ) => statements setting varName: T, (should combine the two values)
  combineStatements,

  // expression: u32 (the index of the thread within the workgroup) - overrideable so we can run multiple smaller loads
  // in the same workgroup if ever desired
  localIndex = `local_id.x`,

  // ( index: expr-u32 ) => expr-u32, allows overriding the index used for the scratch array, so that we can run
  // multiple smaller loads in the same workgroup if ever desired
  mapScratchIndex = _.identity,

  // Whether we should reduce in a convergent order. This will reduce control divergence when running, and will
  // potentially allow warps to exit early. This should result in a speed-up, but the data either needs to have a
  // commutative combine operation, OR the order should be in a "convergent" order. That would mean that for each data
  // chunk read by each workgroup, the indices are bit-reversed (e.g. if we have a workgroup size of 256, then we are
  // reversing the last 8 bits of the index, thus the first element should be stored at index 0, the second element at
  // index 128, the third element at index 64, etc.). See get_convergent_index for more information.
  // For instance, the order of reduction of the first 16 hex digits (in a convergent order) would be
  // 084c2a6e195d3b7f.
  convergent = false
} ) => {
  assert && assert( [ combineExpression, combineStatements ].filter( _.identity ).length === 1,
    'Must provide exactly one of combineExpression or combineStatements' );
  assert && assert( !convergent || Number.isInteger( Math.log2( workgroupSize ) ) );
  assert && assert( !combineStatements || valueType !== null );

  const start = convergent ? Math.log2( workgroupSize ) : 0;
  const end = convergent ? 0 : Math.log2( workgroupSize );
  const condition = i => convergent
    ? `${localIndex} < ${u32( 1 << ( i - 1 ) )}`
    : `${localIndex} % ${u32( 1 << ( i + 1 ) )} == 0u`;
  const accessIndex = i => convergent
    ? `${localIndex} + ${u32( 1 << ( i - 1 ) )}`
    : `${localIndex} + ${u32( 1 << i )}`;

  return `
    ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};

    ${unroll( start, end, ( i, isFirst, isLast ) => `
      workgroupBarrier();

      // TODO: check performance differences with a select/combine?
      if ( ${condition( i )} ) {
        ${combineExpression ? `
          ${value} = ${combineExpression( value, `${scratch}[ ${mapScratchIndex( accessIndex( i ) )} ]` )};
        ` : `
          // TODO: test this
          let next_value: ${valueType};
          ${combineStatements( `nextValue`, value, `${scratch}[ ${mapScratchIndex( accessIndex( i ) )} ]` )}
          ${value} = next_value;
        `}

        ${ !isLast ? `
          ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};
        ` : ``}
      }
    ` )}
  `
} )}
