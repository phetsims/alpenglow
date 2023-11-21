// Copyright 2023, University of Colorado Boulder

/**
 * Provides the ability to log things to a buffer in storage, like console.log would.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#option shaderName
#option log
#option logBinding

#ifdef log
struct _Log {
  next_space: atomic<u32>,
  data: array<u32>
};
@group(0) @binding(${logBinding})
var<storage, read_write> _log: _Log;
#endif

${template( ( {
  name, // string | null - if null, we will mark it as a barrier BETWEEN shaders

  // number | string | ( varName ) => string:statements:u32 (of u32s) - write into pre-existing variable
  // IF it is a function, it will be treated as a dynamic length, and will be written into the log.
  dataLength = 0,

  writeU32s = () => {}, // ( arrayVarName, offset ) => string statements --- only if dataLength > 0
  additionalIndex = null, // null | string:expression:u32 - if provided, will be used as an additional index for the log
  deserialize = arr => arr.length > 1 ? arr : arr[ 0 ], // ( arr: Uint32Array ) => T, takes the data and turns it into a usable value
  lineToLog, // ( line: ConsoleLoggedLine ) => unknown - whatever JS-like format we want to log
} ) => {

  if ( !log ) {
    return '';
  }

  // defaults for lineToLog
  if ( !lineToLog ) {
    lineToLog = dataLength === 0 ? ConsoleLoggedLine.toLogNull : ConsoleLoggedLine.toLogRaw;
  }

  if ( name === null ) {
    return `
      {
        let _log_offset = atomicAdd( &_log.next_space, 1u );
        _log.data[ _log_offset ] = 0u;
      }
    `;
  }
  else {
    const id = ConsoleLogger.register( {
      logName: name,
      shaderName: shaderName,
      dataLength: typeof dataLength === 'number' ? dataLength : null,
      hasAdditionalIndex: additionalIndex !== null,
      deserialize: deserialize,
      lineToLog: lineToLog,
    } );

    const nonDataLength =
      1 + // id
      3 + // workgroup_id
      3 + // local_id
      ( additionalIndex !== null ? 1 : 0 ) + // additional index (if provided)
      ( typeof dataLength !== 'number' ? 1 : 0 ); // data length (if dynamic)

    let countableIndex = 0;

    return `
      {
        ${typeof dataLength === 'number' ? `
          // handle a static dataLength
          let _log_item_length = ${u32( nonDataLength + dataLength )};
        ` : ( typeof dataLength === 'string' ? `
          // handle a dynamic (string:expression:u32) dataLength
          let _log_data_length = ${dataLength};
          let _log_item_length = ${u32( nonDataLength )} + _log_data_length;
        ` : `
          // handle a dynamic (string:statements) dataLength
          var _log_data_length: u32;
          ${dataLength( '_log_data_length' )}
          let _log_item_length = ${u32( nonDataLength )} + _log_data_length;
        ` )}

        var _log_offset = atomicAdd( &_log.next_space, _log_item_length );

        // Don't write past the end (it could scribble, mess up our atomic counter, and make us think we did NOT overrun it)
        if ( _log_offset + _log_item_length > arrayLength( &_log.data ) ) {
          _log.data[ 0u ] = 0xffffffffu;
          _log_offset = 1;
        }

        _log.data[ _log_offset + ${u32( countableIndex++ )} ] = ${u32( id )};
        _log.data[ _log_offset + ${u32( countableIndex++ )} ] = workgroup_id.x;
        _log.data[ _log_offset + ${u32( countableIndex++ )} ] = workgroup_id.y;
        _log.data[ _log_offset + ${u32( countableIndex++ )} ] = workgroup_id.z;
        _log.data[ _log_offset + ${u32( countableIndex++ )} ] = local_id.x;
        _log.data[ _log_offset + ${u32( countableIndex++ )} ] = local_id.y;
        _log.data[ _log_offset + ${u32( countableIndex++ )} ] = local_id.z;

        ${additionalIndex !== null ? `
          _log.data[ _log_offset + ${u32( countableIndex++ )} ] = ${additionalIndex};
        ` : ''}

        ${typeof dataLength !== 'number' ? `
          _log.data[ _log_offset + ${u32( countableIndex++ )} ] = _log_data_length;
        ` : ''}

        ${dataLength !== 0 ? `
          ${writeU32s( '_log.data', `_log_offset + ${u32( countableIndex++ )}` )}
        ` : ''}
      }
    `;
  }
} )}
