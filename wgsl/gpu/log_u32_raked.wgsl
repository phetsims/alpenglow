// Copyright 2023, University of Colorado Boulder

/**
 * Specialized logging TODO doc, TODO factor out common parts
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./log
#import ./if_log

${template( ( {
  // TODO: better forwarding of our options through?
  name, // string | null - if null, we will mark it as a barrier BETWEEN shaders
  additionalIndex = null, // null | string:expression:u32 - if provided, will be used as an additional index for the log
  deserialize = arr => [ ...arr ], // ( arr: Uint32Array ) => T, takes the data and turns it into a usable value
  lineToLog = ConsoleLoggedLine.toLogExistingFlat, // ( line: ConsoleLoggedLine ) => unknown - whatever JS-like format we want to log

  workgroupSize,
  grainSize,
  length = null, // ASSUMED to be provided? (if not provided(!)) TODO support not provided
  relativeLength = null,
  skipBarriers = false,

  accessExpression = null, // ( index ) => string:expression:u32
  relativeAccessExpression = null, // ( index ) => string:expression:u32
} ) => {
  assert && assert( !accessExpression !== !relativeAccessExpression, 'One should be provided' );

  return `
    ${if_log( `
      {
        ${!skipBarriers ? `
          workgroupBarrier();
          storageBarrier();
        ` : ``}

        let base_log_index = workgroup_id.x * ${u32( workgroupSize * grainSize )};
        let base_local_log_index = ${u32( grainSize )} * local_id.x;
        let combined_base = base_log_index + base_local_log_index;

        ${length !== null ? `
          if ( combined_base < ${length} ) {
        ` : ``}
        ${relativeLength !== null ? `
          if ( base_local_log_index < ${relativeLength} ) {
        ` : ``}

        var log_length = ${u32( grainSize )};
        ${length !== null ? `
          log_length = min( log_length, ${length} - combined_base );
        ` : ``}
        ${relativeLength !== null ? `
          log_length = min( log_length, ${relativeLength} - base_local_log_index );
        ` : ``}

        ${log( {
          name: name,
          additionalIndex: additionalIndex,
          deserialize: deserialize,
          lineToLog: lineToLog,
          dataLength: `log_length`,
          writeU32s: ( arr, offset ) => `
            for ( var _i = 0u; _i < log_length; _i++ ) {
              ${accessExpression ? `
                // "global" access
                ${arr}[ ${offset} + _i ] = ${accessExpression( `combined_base + _i` )};
              ` : `
                // "local" access
                ${arr}[ ${offset} + _i ] = ${relativeAccessExpression( `base_local_log_index + _i` )};
              `}
            }
          `,
        } )}

        ${relativeLength !== null ? `
          }
        ` : ``}
        ${length !== null ? `
          }
        ` : ``}
      }
    ` )}
  `;
} )}
