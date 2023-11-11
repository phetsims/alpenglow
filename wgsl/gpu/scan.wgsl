// Copyright 2023, University of Colorado Boulder

/**
 * A template that performs a scan operation using workgroup memory on a single workgroup.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./unroll

${template( ( {
  // the "input" and "output" variable name
  value,

  // the name of var<workgroup> array<{valueType}, {workgroupSize}>
  scratch,

  // The direction of the scan. For instance, a left inclusive scan of [ 1, 2, 3, 4 ] is [ 1, 3, 6, 10 ],
  // but a right incluive scan is [ 10, 9, 7, 4 ] (just scans in the other direction)
  direction = 'left', // 'left' | 'right'

  // number (the number of threads running this command)
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

  // boolean (whether the scan should be exclusive - otherwise it is inclusive).
  // e.g. an inclusive left scan of [ 1, 2, 3, 4 ] is [ 1, 3, 6, 10 ], whereas an exclusive left scan is [ 0, 1, 3, 6 ]
  exclusive = false,

  // if the scratch value doesn't need to be accurate, we can skip this
  needsValidScratch = false, // TODO: think about the best default?

  // TODO: some of this is duplicated with reduce.wgsl, how can we factor it out?
  // If true, we won't need to load the value INTO the scratch array
  scratchPreloaded = false,

  // If true, we won't need to load the value FROM the scratch array
  valuePreloaded = true,
} ) => {

  const condition = i => direction === 'left'
    ? `${localIndex} >= ${u32( 1 << i )}`
    : `${localIndex} < ${u32( workgroupSize - ( 1 << i ) )}`;

  const combineLeft = i => direction === 'left'
    ? `${scratch}[ ${mapScratchIndex( `${localIndex} - ${u32( 1 << i )}` )} ]`
    : value;

  const combineRight = i => direction === 'left'
    ? value
    : `${scratch}[ ${mapScratchIndex( `${localIndex} + ${u32( 1 << i )}` )} ]`;

  return `
    ${comment( `begin scan direction:${direction} exclusive:${exclusive}` )}
    ${!scratchPreloaded ? `
      ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};
    ` : ``}
    ${!valuePreloaded ? `
      ${value} = ${scratch}[ ${mapScratchIndex( localIndex )} ];
    ` : ``}

    ${unroll( 0, Math.log2( workgroupSize ), ( i, isFirst, isLast ) => `
      // TODO: duplicated with reduce.wgsl... factor something out? Eventually?
      // We don't need the first workgroupBarrier() if scratchPreloaded is true
      ${!scratchPreloaded || !isFirst ? `
        workgroupBarrier();
      ` : ``}

      // TODO: check performance differences with a select/combine?
      if ( ${condition( i )} ) {
        ${combineExpression ? `
          ${value} = ${combineExpression( combineLeft( i ), combineRight( i ) )};
        ` : `
          ${combineStatements( value, combineLeft( i ), combineRight( i ) )}
        `}
      }

      ${ isLast && !needsValidScratch && !exclusive ? `` : `
        workgroupBarrier();

        ${scratch}[ ${mapScratchIndex( localIndex )} ] = ${value};
      `}
    ` )}

    // TODO: consider shift at start to potentially avoid this workgroupBarrier?
    ${exclusive ? `
      workgroupBarrier();

      ${direction === 'left' ? `
        ${value} = select( ${identity}, ${scratch}[ ${mapScratchIndex( `${localIndex} - 1u` )} ], ${localIndex} > 0u );
      ` : `
        ${value} = select( ${identity}, ${scratch}[ ${mapScratchIndex( `${localIndex} + 1u` )} ], ${localIndex} < ${u32( workgroupSize - 1 )} );
      `}
    ` : ``}

    // TODO: consider if we should update the scratch values after, OR keep it nice after exclusive.
    ${comment( 'end scan' )}
  `;
} )}
