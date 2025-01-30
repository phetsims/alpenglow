// Copyright 2023-2024, University of Colorado Boulder

/**
 * Provides the ability to log things to a buffer in storage, like console.log would.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import { u32S, wgsl, wgslBlueprint, WGSLExpression, WGSLExpressionT, WGSLExpressionU32, WGSLStatements, WGSLString, WGSLVariableName } from '../WGSLString.js';
import { ConcreteType } from '../../compute/ConcreteType.js';
import { ConsoleLoggedLine, ConsoleLogger } from '../../compute/ConsoleLogger.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';
import { logBufferSlot } from '../../compute/logBufferSlot.js';

export type logWGSLOptions<T> = {
  // - if null, we will mark it as a barrier BETWEEN shaders
  name: string | null;

  // if provided, will be used as an additional index for the log
  additionalIndex?: WGSLExpressionU32 | null;

  type?: ConcreteType<T> | null;

  writeData?: ( ( write: ( tIndex: WGSLExpressionU32, tValue: WGSLExpressionT ) => WGSLStatements ) => WGSLStatements ) | null;

  // (of # elements) - write into pre-existing variable
  // IF it is a function, it will be treated as a dynamic length, and will be written into the log.
  dataCount?: number | WGSLString | ( ( varName: WGSLVariableName ) => WGSLStatements );

  // into whatever JS-like format we want to log
  lineToLog?: ( ( line: ConsoleLoggedLine ) => unknown ) | null;

  workgroupId?: WGSLExpression;
  localId?: WGSLExpression;
};

export const LOG_DEFAULTS = {
  additionalIndex: null,
  type: null,
  writeData: null,
  dataCount: 0,
  lineToLog: null,
  workgroupId: wgsl`workgroup_id`,
  localId: wgsl`local_id`
} as const;

export const logWGSL = <T>(
  providedOptions: logWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<logWGSLOptions<T>>()( {}, LOG_DEFAULTS, providedOptions );

  const name = options.name;
  const additionalIndex = options.additionalIndex;
  const type = options.type;
  const writeData = options.writeData;
  const dataCount = options.dataCount;
  let lineToLog = options.lineToLog;

  return wgslBlueprint( blueprint => {

    if ( !blueprint.log ) {
      return wgsl``;
    }

    assert && assert( type || dataCount === 0 );

    blueprint.addSlot( '_log', logBufferSlot, BufferBindingType.STORAGE );

    // defaults for lineToLog
    if ( !lineToLog ) {
      lineToLog = dataCount === 0 ? ConsoleLoggedLine.toLogNull : ConsoleLoggedLine.toLogExistingFlat;
    }

    if ( name === null ) {
      return wgsl`
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
        shaderName: blueprint.name,
        dataCount: typeof dataCount === 'number' ? dataCount : null,
        hasAdditionalIndex: additionalIndex !== null,
        lineToLog: lineToLog
      } );

      const nonDataLength =
        1 + // id
        3 + // workgroup_id
        3 + // local_id
        ( additionalIndex !== null ? 1 : 0 ) + // additional index (if provided)
        ( typeof dataCount !== 'number' ? 1 : 0 ); // data length (if dynamic)

      let countableIndex = 0;

      return wgsl`
        {
          ${typeof dataCount === 'number' ? wgsl`
            // handle a static dataCount
            let _log_item_length = ${u32S( nonDataLength + dataCount * ( dataCount === 0 ? 0 : type!.bytesPerElement / 4 ) )};
          ` : ( dataCount instanceof WGSLString ? wgsl`
            // handle a dynamic (string:expression:u32) dataCount
            let _log_data_count = ${dataCount};
            let _log_item_length = ${u32S( nonDataLength )} + _log_data_count * ${u32S( type!.bytesPerElement / 4 )};
          ` : wgsl`
            // handle a dynamic (string:statements) dataCount
            var _log_data_count: u32;
            ${dataCount( wgsl`_log_data_count` )}
            let _log_item_length = ${u32S( nonDataLength )} + _log_data_count * ${u32S( type!.bytesPerElement / 4 )};
          ` )}
  
          var _log_offset = atomicAdd( &_log.next_space, _log_item_length );
  
          // Don't write past the end (it could scribble, mess up our atomic counter, and make us think we did NOT overrun it)
          if ( _log_offset + _log_item_length > arrayLength( &_log.data ) ) {
            _log.data[ 0u ] = 0xffffffffu;
            _log_offset = 1;
          }
  
          _log.data[ _log_offset + ${u32S( countableIndex++ )} ] = ${u32S( id )};
          _log.data[ _log_offset + ${u32S( countableIndex++ )} ] = ${options.workgroupId}.x;
          _log.data[ _log_offset + ${u32S( countableIndex++ )} ] = ${options.workgroupId}.y;
          _log.data[ _log_offset + ${u32S( countableIndex++ )} ] = ${options.workgroupId}.z;
          _log.data[ _log_offset + ${u32S( countableIndex++ )} ] = ${options.localId}.x;
          _log.data[ _log_offset + ${u32S( countableIndex++ )} ] = ${options.localId}.y;
          _log.data[ _log_offset + ${u32S( countableIndex++ )} ] = ${options.localId}.z;
  
          ${additionalIndex !== null ? wgsl`
            _log.data[ _log_offset + ${u32S( countableIndex++ )} ] = ${additionalIndex};
          ` : wgsl``}
  
          ${typeof dataCount !== 'number' ? wgsl`
            _log.data[ _log_offset + ${u32S( countableIndex++ )} ] = _log_data_count;
          ` : wgsl``}
  
          ${dataCount !== 0 ? wgsl`
            ${writeData!( ( tIndex, tExpr ) => {
              return type!.writeU32s( ( offset, u32Expr ) => {
                return wgsl`_log.data[ _log_offset + ${u32S( countableIndex )} + ( ${tIndex} ) * ${u32S( type!.bytesPerElement / 4 )} + ( ${offset} ) ] = ${u32Expr};`;
              }, tExpr );
            } )}
          ` : wgsl``}
        }
      `;
    }
  } );
};

alpenglow.register( 'logWGSL', logWGSL );