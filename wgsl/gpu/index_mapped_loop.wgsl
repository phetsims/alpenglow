// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc (it's one of the more important ones)
 *
 * globalIndex === workgroupSize * workgroupIndex + localIndex;
 *
 * orders:
 * blocked: grainSize * globalIndex + i === grainSize * workgroupSize * workgroupIndex + grainSize * localIndex + i
 * striped: workgroupSize * grainSize * workgroupIndex + workgroupSize * i + localIndex
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  // number (the number of threads running this command)
  workgroupSize,

  // number (the number of elements each thread should process)
  grainSize,

  // expression: u32 (the global index of the thread) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  globalIndex = `global_id.x`,

  // expression: u32 (the index of the workgroup) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  workgroupIndex = `workgroup_id.x`,

  // expression: u32 (the index of the thread within the workgroup) - overrideable so we can run multiple smaller loads
  // in the same workgroup if ever desired
  localIndex = `local_id.x`,

  // The actual order of the data in memory (needed for range checks, not required if range checks are disabled)
  inputOrder, // 'blocked' | 'striped'

  // The order of access to the input data (determines the "value" output order also)
  inputAccessOrder, // 'blocked' | 'striped'  NOTE: Not just striped, if we're using this somehow and mapping indices ourselves

  outputOrder, // 'blocked' | 'striped'

  // Whether local variables should be used to factor out subexpressions (potentially more register usage, but less
  // computation).
  factorOutSubexpressions = true,

  // ( {
  //   index: number,
  //   isFirst: boolean,
  //   isLast: boolean,
  //   getInputIndex( { isRelative = false, parentheses: true } ): string (expr)
  //   getBlockedInputIndex( { isRelative = false, parentheses: true } ): string (expr) - for things like range checks
  //   getOutputIndex( { isRelative = false, parentheses: true } ): string (expr)
  // } ) => string (statements)
  callback,
} ) => {
  assert && assert( workgroupSize );
  assert && assert( grainSize );
  assert && assert( inputAccessOrder === 'blocked' || inputAccessOrder === 'striped' );

  assert && assert( inputOrder !== 'striped' || inputAccessOrder !== 'blocked', 'Do not use blocked order on striped data' );

  const parenWrap = ( expr, condition ) => condition ? `( ${expr} )` : expr;
  const plusN = i => i > 0 ? ` + ${u32( i )}` : ``;

  const counts = {
    im_blocked_index_relative: 0, // ${u32( grainSize )} * ${localIndex} + ${u32( i )}
    im_blocked_index: 0, // ${u32( grainSize )} * ${globalIndex} + ${u32( i )}
    im_striped_index_relative: 0, // ${localIndex}${plusN( i * workgroupSize )}
    im_striped_index: 0, // ${workgroupIndex} * ${u32( workgroupSize * grainSize )}${plusN( i * workgroupSize )} + ${localIndex}
    im_blocked_from_striped_index_relative: 0, // ${localIndex} * ${u32( grainSize )} + ${u32( i )}
    im_blocked_from_striped_index: 0, // ${workgroupIndex} * ${u32( workgroupSize * grainSize )} + ${localIndex} * ${u32( grainSize )} + ${u32( i )}
  };
  const sets = _.range( 0, grainSize ).map( () => new Set() );
  const noteCount = ( i, str ) => {
    counts[ str ]++;
    sets[ i ].add( str );
    return str;
  };

  const getBlockedInputIndex = ( i, isRelative ) => {
    assert && assert( typeof i === 'number' );

    if ( isRelative ) {
      return factorOutSubexpressions
        ? noteCount( `im_blocked_index_relative` )
        : `${u32( grainSize )} * ${localIndex}${plusN( i )}`;
    }
    else {
      return factorOutSubexpressions
        ? noteCount( `im_blocked_index` )
        : `${u32( grainSize )} * ${globalIndex}${plusN( i )}`;
    }
  };

  const getStripedInputIndex = ( i, isRelative ) => {
    assert && assert( typeof i === 'number' );

    if ( isRelative ) {
      return factorOutSubexpressions
        ? noteCount( `im_striped_index_relative` )
        : `${localIndex}${plusN( i * workgroupSize )}`;
    }
    else {
      return factorOutSubexpressions
        ? noteCount( `im_striped_index` )
        : `${workgroupIndex} * ${u32( workgroupSize * grainSize )}${plusN( i * workgroupSize )} + ${localIndex}`;
    }
  };

  const getBlockedFromStripedInputIndex = ( i, isRelative ) => {
    assert && assert( typeof i === 'number' );

    if ( isRelative ) {
      return factorOutSubexpressions
        ? noteCount( `im_blocked_from_striped_index_relative` )
        : `${localIndex} * ${u32( grainSize )}${plusN( i )}`;
    }
    else {
      return factorOutSubexpressions
        ? noteCount( `im_blocked_from_striped_index` )
        : `${workgroupIndex} * ${u32( workgroupSize * grainSize )} + ${localIndex} * ${u32( grainSize )}${plusN( i )}`;
    }
  };

  const statementList = _.range( 0, grainSize, i => callback( {
    index: i,
    isFirst: i === 0,
    isLast: i === grainSize - 1,
    getInputIndex: ( { isRelative = false, parentheses = true } ) => {
      let result;
      if ( inputAccessOrder === 'blocked' ) {
        result = getBlockedInputIndex( i, isRelative );
      }
      else if ( inputAccessOrder === 'striped' ) {
        result = getStripedInputIndex( i, isRelative );
      }
      else {
        throw new Error( `Unrecognized inputAccessOrder: ${inputAccessOrder}` );
      }
      return parenWrap( result, parentheses );
    },
    getBlockedInputIndex: ( { isRelative = false, parentheses = true } ) => {
      let result;
      if ( inputAccessOrder === 'blocked' ) {
        result = getBlockedInputIndex( i, isRelative );
      }
      else if ( inputAccessOrder === 'striped' ) {
        if ( inputOrder === 'striped' ) {
          result = getBlockedFromStripedInputIndex( i, isRelative );
        }
        else if ( inputOrder === 'blocked' ) {
          result = getStripedInputIndex( i, isRelative );
        }
        else {
          throw new Error( `Unrecognized inputOrder: ${inputOrder}` );
        }
      }
      else {
        throw new Error( `Unrecognized inputAccessOrder: ${inputAccessOrder}` );
      }
      return parenWrap( result, parentheses );
    },
    getOutputIndex: ( { isRelative = false, parentheses = true } ) => {
      let resut;
      if ( outputOrder === 'blocked' ) {
        if ( inputAccessOrder === 'blocked' ) {
          assert && assert( inputOrder === 'blocked' );

          result = getBlockedInputIndex( i, isRelative );
        }
        else if ( inputAccessOrder === 'striped' ) {
          if ( inputOrder === 'blocked' ) {
            result = getStripedInputIndex( i, isRelative );
          }
          else if ( inputOrder === 'striped' ) {
            result = getBlockedFromStripedInputIndex( i, isRelative );
          }
          else {
            throw new Error( `Unrecognized inputOrder: ${inputOrder}` );
          }
        }
        else {
          throw new Error( `Unrecognized inputAccessOrder: ${inputAccessOrder}` );
        }
      }
      else if ( outputOrder === 'striped' ) {
        if ( inputAccessOrder === 'blocked' ) {
          assert && assert( inputOrder === 'blocked' );

          throw new Error( 'unimplemented' ); // TODO: implement
        }
        else if ( inputAccessOrder === 'striped' ) {
          if ( inputOrder === 'blocked' ) {
            throw new Error( 'unimplemented' ); // TODO: implement
          }
          else if ( inputOrder === 'striped' ) {
            result = getStripedInputIndex( i, isRelative );
          }
          else {
            throw new Error( `Unrecognized inputOrder: ${inputOrder}` );
          }
        }
        else {
          throw new Error( `Unrecognized inputAccessOrder: ${inputAccessOrder}` );
        }
      }
      else {
        throw new Error( `Unrecognized outputOrder: ${outputOrder}` );
      }
      return parenWrap( result, parentheses );
    },
  } ) );

  // TODO: simplify +0, *0?
  if ( factorOutSubexpressions ) {
    const outerDeclarations = [];

    let im_blocked_index_relative = i => `${u32( grainSize )} * ${localIndex}${plusN( i )}`;
    let im_blocked_index = i => `${u32( grainSize )} * ${globalIndex}${plusN( i )}`;
    let im_striped_index_relative = i => `${localIndex}${plusN( i * workgroupSize )}`;
    let im_striped_index = i => `${workgroupIndex} * ${u32( workgroupSize * grainSize )}${plusN( i * workgroupSize )} + ${localIndex}`;
    let im_blocked_from_striped_index_relative = i => `${localIndex} * ${u32( grainSize )}${plusN( i )}`;
    let im_blocked_from_striped_index = i => `${workgroupIndex} * ${u32( workgroupSize * grainSize )} + ${localIndex} * ${u32( grainSize )}${plusN( i )}`;

    // subexpressions that might be simplified AND reused
    let im_workgroup_base = `${workgroupIndex} * ${u32( workgroupSize * grainSize )}`;
    let im_local_offset = `${localIndex} * ${u32( grainSize )}`;

    if ( counts.im_blocked_from_striped_index_relative > 1 ) {
      outerDeclarations.push( `let im_local_offset = ${im_local_offset};` );
      im_local_offset = `im_local_offset`;

      im_blocked_from_striped_index_relative = i => `${im_local_offset}${plusN( i )}`;
    }

    if ( counts.im_blocked_from_striped_index > 1 ) {
      outerDeclarations.push( `let im_workgroup_base = ${im_workgroup_base};` );
      im_workgroup_base = `im_workgroup_base`;

      outerDeclarations.push( `let im_blocked_striped_base = ${im_workgroup_base} + ${im_local_offset};` );

      im_striped_index = i => `${im_workgroup_base}${plusN( i * workgroupSize )} + ${localIndex}`;
      im_blocked_from_striped_index = i => `im_blocked_striped_base${plusN( i )}`;
    }

    if ( counts.im_striped_index > 1 ) {
      outerDeclarations.push( `let im_striped_base = ${im_workgroup_base} + ${localIndex};` );

      im_striped_index = i => `im_striped_base${plusN( i * workgroupSize )}`;
    }

    if ( counts.im_blocked_index_relative > 1 ) {
      outerDeclarations.push( `let im_blocked_relative_base = ${u32( grainSize )} * ${localIndex};` );

      im_blocked_index_relative = i => `im_blocked_relative_base${plusN( i )}`;
    }

    if ( counts.im_blocked_index > 1 ) {
      outerDeclarations.push( `let im_blocked_base = ${u32( grainSize )} * ${globalIndex};` );

      im_blocked_index = i => `im_blocked_base${plusN( i )}}`;
    }

    return `
      ${outerDeclarations.length ? `{\n${outerDeclarations.join( '\n' )}` : ``}

      ${unroll( 0, grainSize, i => `
        {
          ${sets[ i ].has( 'im_blocked_index_relative' ) ? `let im_blocked_index_relative = ${im_blocked_index_relative( i )};` : ``}
          ${sets[ i ].has( 'im_blocked_index' ) ? `let im_blocked_index = ${im_blocked_index( i )};` : ``}
          ${sets[ i ].has( 'im_striped_index_relative' ) ? `let im_striped_index_relative = ${im_striped_index_relative( i )};` : ``}
          ${sets[ i ].has( 'im_striped_index' ) ? `let im_striped_index = ${im_striped_index( i )};` : ``}
          ${sets[ i ].has( 'im_blocked_from_striped_index_relative' ) ? `let im_blocked_from_striped_index_relative = ${im_blocked_from_striped_index_relative( i )};` : ``}
          ${sets[ i ].has( 'im_blocked_from_striped_index' ) ? `let im_blocked_from_striped_index = ${im_blocked_from_striped_index( i )};` : ``}
          ${statementList[ i ]}
        }
      `)}

      ${outerDeclarations.length ? `}` : ``}
    `;
  }
  else {
    return statementList.join( '\n' );
  }
} )}
