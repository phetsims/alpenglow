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
struct Log {
  next_space: atomic<u32>,
  data: array<u32>
};
@group(0) @binding(${logBinding})
var<storage, read_write> log: Log;
#endif

${template( ( {
  name, // string | null - if null, we will mark it as a barrier BETWEEN shaders
  dataLength = 0, // number (of u32s)
  writeU32s = () => {}, // ( arrayVarName, offset ) => string statements --- only if dataLength > 0
  additionalIndex = null, // null | string:expression:u32 - if provided, will be used as an additional index for the log
} ) => {

  if ( !log ) {
    return '';
  }

  if ( name === null ) {
    return `
      {
        let log_offset = atomicAdd( &log.next_space, 1u );
        log.data[ log_offset ] = 0u;
      }
    `;
  }
  else {
    const id = ConsoleLogger.register( {
      logName: name,
      shaderName: shaderName,
      dataLength: dataLength,
      hasAdditionalIndex: additionalIndex !== null
    } );

    const fullLength =
      1 + // id
      3 + // workgroup_id
      3 + // local_id
      ( additionalIndex !== null ? 1 : 0 ) + // additional index
      dataLength;

    return `
      {
        // TODO: log all of the indices, etc.
        let log_item_length = ${u32( fullLength )};
        let log_offset = atomicAdd( &log.next_space, log_item_length );

        log.data[ log_offset ] = ${u32( id )};
        log.data[ log_offset + 1u ] = workgroup_id.x;
        log.data[ log_offset + 2u ] = workgroup_id.y;
        log.data[ log_offset + 3u ] = workgroup_id.z;
        log.data[ log_offset + 4u ] = local_id.x;
        log.data[ log_offset + 5u ] = local_id.y;
        log.data[ log_offset + 6u ] = local_id.z;

        ${additionalIndex !== null ? `
          log.data[ log_offset + 7u ] = ${additionalIndex};
        ` : ''}

        ${dataLength > 0 ? `
          ${writeU32s( 'log.data', `log_offset + ${additionalIndex !== null ? '8u' : '7u'}` )}
        ` : ''}
      }
    `;
  }
} )}