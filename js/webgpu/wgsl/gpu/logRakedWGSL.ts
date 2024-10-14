// Copyright 2023-2024, University of Colorado Boulder

/**
 * Specialized logging TODO doc, TODO factor out common parts
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, logWGSL, logWGSLOptions, RakedSizable, u32S, wgsl, wgslBlueprint, WGSLExpression, WGSLExpressionU32, WGSLStatements } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import PickRequired from '../../../../../phet-core/js/types/PickRequired.js';

type SelfOptions = {
  lengthExpression?: WGSLExpressionU32 | null;
  relativeLengthExpression?: WGSLExpressionU32 | null;
  skipBarriers?: boolean;
  accessExpression?: ( ( index: WGSLExpressionU32 ) => WGSLExpression ) | null;
  relativeAccessExpression?: ( ( index: WGSLExpressionU32 ) => WGSLExpression ) | null;
} & RakedSizable;

export type logRakedWGSLOptions<T> = SelfOptions & StrictOmit<logWGSLOptions<T>, 'dataCount' | 'writeData'> & PickRequired<logWGSLOptions<T>, 'type'>;

export const LOG_RAKED_OPTIONS = {
  lengthExpression: null,
  relativeLengthExpression: null,
  skipBarriers: false,
  accessExpression: null,
  relativeAccessExpression: null
} as const;

const logRakedWGSL = <T>(
  providedOptions: logRakedWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<logRakedWGSLOptions<T>, SelfOptions>()( {}, LOG_RAKED_OPTIONS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const lengthExpression = options.lengthExpression;
  const relativeLengthExpression = options.relativeLengthExpression;
  const skipBarriers = options.skipBarriers;
  const accessExpression = options.accessExpression;
  const relativeAccessExpression = options.relativeAccessExpression;

  // TODO: consider TS hooks to enforce these
  assert && assert( lengthExpression || relativeLengthExpression );
  assert && assert( accessExpression || relativeAccessExpression );

  return wgslBlueprint( blueprint => {

    if ( blueprint.log ) {
      return wgsl`
        {
          ${!skipBarriers ? wgsl`
            workgroupBarrier();
            storageBarrier();
          ` : wgsl``}
  
          let base_log_index = workgroup_id.x * ${u32S( workgroupSize * grainSize )};
          let base_local_log_index = ${u32S( grainSize )} * local_id.x;
          let combined_base = base_log_index + base_local_log_index;
  
          ${lengthExpression !== null ? wgsl`
            if ( combined_base < ${lengthExpression} ) {
          ` : wgsl``}
          ${relativeLengthExpression !== null ? wgsl`
            if ( base_local_log_index < ${relativeLengthExpression} ) {
          ` : wgsl``}
  
          var log_length = ${u32S( grainSize )};
          ${lengthExpression !== null ? wgsl`
            log_length = min( log_length, ${lengthExpression} - combined_base );
          ` : wgsl``}
          ${relativeLengthExpression !== null ? wgsl`
            log_length = min( log_length, ${relativeLengthExpression} - base_local_log_index );
          ` : wgsl``}
  
          ${logWGSL( combineOptions<logWGSLOptions<T>>( {
            dataCount: wgsl`log_length`,
            writeData: ( write: ( tIndex: WGSLExpressionU32, tValue: WGSLExpression ) => WGSLStatements ) => wgsl`
              for ( var _i = 0u; _i < log_length; _i++ ) {
                ${accessExpression ? wgsl`
                  // "global" access
                  let _expr = ${accessExpression( wgsl`combined_base + _i` )};
                ` : wgsl`
                  // "local" access
                  let _expr = ${relativeAccessExpression!( wgsl`base_local_log_index + _i` )};
                `}
                ${write( wgsl`_i * ${u32S( options.type!.bytesPerElement / 4 )}`, wgsl`_expr` )}
              }
            `
          }, options ) )}
  
          ${relativeLengthExpression !== null ? wgsl`
            }
          ` : wgsl``}
          ${lengthExpression !== null ? wgsl`
            }
          ` : wgsl``}
        }
      `;
    }
    else {
      return wgsl``;
    }
  } );
};

export default logRakedWGSL;

alpenglow.register( 'logRakedWGSL', logRakedWGSL );