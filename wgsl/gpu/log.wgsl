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
  additionalIndex = null, // null | string:expression:u32 - if provided, will be used as an additional index for the log

  type = null,
  // number | string | ( varName ) => string:statements:u32 (of # elements) - write into pre-existing variable
  // IF it is a function, it will be treated as a dynamic length, and will be written into the log.
  dataCount = 0,

  // ( storeStatement: ( offset: expr:u32, u32expr: expr:u32 ) => string:statements ) => string:statements
  //  --- only if dataCount > 0
  writeU32s = () => {},

  lineToLog, // ( line: ConsoleLoggedLine ) => unknown - whatever JS-like format we want to log
} ) => {

  if ( !log ) {
    return '';
  }

  // defaults for lineToLog
  if ( !lineToLog ) {
    lineToLog = dataCount === 0 ? ConsoleLoggedLine.toLogNull : ConsoleLoggedLine.toLogExistingFlat;
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
      type: type,
      logName: name,
      shaderName: shaderName,
      dataCount: typeof dataCount === 'number' ? dataCount : null,
      hasAdditionalIndex: additionalIndex !== null,
      lineToLog: lineToLog,
    } );

    const nonDataLength =
      1 + // id
      3 + // workgroup_id
      3 + // local_id
      ( additionalIndex !== null ? 1 : 0 ) + // additional index (if provided)
      ( typeof dataCount !== 'number' ? 1 : 0 ); // data length (if dynamic)

    let countableIndex = 0;

    return `
      {
        ${typeof dataCount === 'number' ? `
          // handle a static dataCount
          let _log_item_length = ${u32( nonDataLength + dataCount * ( dataCount === 0 ? 0 : type.bytesPerElement / 4 ) )};
        ` : ( typeof dataCount === 'string' ? `
          // handle a dynamic (string:expression:u32) dataCount
          let _log_data_count = ${dataCount};
          let _log_item_length = ${u32( nonDataLength )} + _log_data_count * ${u32( type.bytesPerElement / 4 )};
        ` : `
          // handle a dynamic (string:statements) dataCount
          var _log_data_count: u32;
          ${dataCount( '_log_data_count' )}
          let _log_item_length = ${u32( nonDataLength )} + _log_data_count * ${u32( type.bytesPerElement / 4 )};
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

        ${typeof dataCount !== 'number' ? `
          _log.data[ _log_offset + ${u32( countableIndex++ )} ] = _log_data_count;
        ` : ''}

        ${dataCount !== 0 ? `
          ${writeU32s( ( offset, expr ) => `_log.data[ _log_offset + ${u32( countableIndex )} + ( ${offset} ) ] = ${expr};` )}
        ` : ''}
      }
    `;
  }
} )}
