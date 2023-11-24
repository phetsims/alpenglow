// Copyright 2023, University of Colorado Boulder

/**
 * Provides the ability to log a single value out
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./log

${template( ( {
  type,
  value, // string:expr:type
  name, // if not provided, will use value.
  additionalIndex = null, // null | string:expression:u32 - if provided, will be used as an additional index for the log
  lineToLog, // ( line: ConsoleLoggedLine ) => unknown - whatever JS-like format we want to log
} ) => {
  if ( !name ) {
    name = value;
  }

  // TODO: better pass-through of options, in TypeScript
  return log( {
    name: name,
    additionalIndex: additionalIndex,
    type: type,
    dataCount: 1,
    writeU32s: storeStatement => type.writeU32s( storeStatement, value ),
    lineToLog,
  } );
} )}
