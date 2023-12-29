// Copyright 2023, University of Colorado Boulder

/**
 * Specialized logging TODO doc, TODO factor out common parts
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, logWGSL, logWGSLOptions, RakedSizable, u32, PipelineBlueprint, WGSLExpression, WGSLExpressionU32, WGSLStatements } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import PickRequired from '../../../../../phet-core/js/types/PickRequired.js';

export type logRakedWGSLOptions<T> = {
  lengthExpression?: WGSLExpressionU32 | null;
  relativeLengthExpression?: WGSLExpressionU32 | null;
  skipBarriers?: boolean;
  accessExpression?: ( ( index: WGSLExpressionU32 ) => WGSLExpression ) | null;
  relativeAccessExpression?: ( ( index: WGSLExpressionU32 ) => WGSLExpression ) | null;
} & RakedSizable & StrictOmit<logWGSLOptions<T>, 'dataCount' | 'writeData'> & PickRequired<logWGSLOptions<T>, 'type'>;

export const LOG_RAKED_OPTIONS = {
  lengthExpression: null,
  relativeLengthExpression: null,
  skipBarriers: false,
  accessExpression: null,
  relativeAccessExpression: null
} as const;

const logRakedWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: logRakedWGSLOptions<T>
): WGSLStatements => {

  const options = combineOptions<logRakedWGSLOptions<T>>( {}, LOG_RAKED_OPTIONS, providedOptions );

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

  if ( blueprint.log ) {
    return `
      {
        ${!skipBarriers ? `
          workgroupBarrier();
          storageBarrier();
        ` : ''}

        let base_log_index = workgroup_id.x * ${u32( workgroupSize * grainSize )};
        let base_local_log_index = ${u32( grainSize )} * local_id.x;
        let combined_base = base_log_index + base_local_log_index;

        ${lengthExpression !== null ? `
          if ( combined_base < ${lengthExpression} ) {
        ` : ''}
        ${relativeLengthExpression !== null ? `
          if ( base_local_log_index < ${relativeLengthExpression} ) {
        ` : ''}

        var log_length = ${u32( grainSize )};
        ${lengthExpression !== null ? `
          log_length = min( log_length, ${lengthExpression} - combined_base );
        ` : ''}
        ${relativeLengthExpression !== null ? `
          log_length = min( log_length, ${relativeLengthExpression} - base_local_log_index );
        ` : ''}

        ${logWGSL( blueprint, combineOptions<logWGSLOptions<T>>( {
          dataCount: 'log_length',
          writeData: ( write: ( tIndex: WGSLExpressionU32, tValue: WGSLExpression ) => WGSLStatements ) => `
            for ( var _i = 0u; _i < log_length; _i++ ) {
              ${accessExpression ? `
                // "global" access
                let _expr = ${accessExpression( 'combined_base + _i' )};
              ` : `
                // "local" access
                let _expr = ${relativeAccessExpression!( 'base_local_log_index + _i' )};
              `}
              ${write( `_i * ${u32( options.type!.bytesPerElement / 4 )}`, '_expr' )}
            }
          `
        }, options ) )}

        ${relativeLengthExpression !== null ? `
          }
        ` : ''}
        ${lengthExpression !== null ? `
          }
        ` : ''}
      }
    `;
  }
  else {
    return '';
  }
};

export default logRakedWGSL;

alpenglow.register( 'logRakedWGSL', logRakedWGSL );
