// Copyright 2023, University of Colorado Boulder

/**
 * A simple unrolled loop that provides both a "blocked" and "striped" (coalesced) index for each iteration.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, conditionalIfWGSL, LOCAL_INDEXABLE_DEFAULTS, LocalIndexable, u32, unrollWGSL, WGSLExpressionU32, WGSLStatements, WORKGROUP_INDEXABLE_DEFAULTS, WorkgroupIndexable } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type coalescedLoopWGSLOptions = {
  workgroupSize: number;
  grainSize: number;
  lengthExpression?: WGSLExpressionU32 | null;
  callback: ( localIndex: WGSLExpressionU32, dataIndex: WGSLExpressionU32 ) => WGSLStatements;
} & WorkgroupIndexable & LocalIndexable;

export const COALESCED_LOOP_DEFAULT_OPTIONS = {
  lengthExpression: null,
  ...WORKGROUP_INDEXABLE_DEFAULTS, // eslint-disable-line no-object-spread-on-non-literals
  ...LOCAL_INDEXABLE_DEFAULTS // eslint-disable-line no-object-spread-on-non-literals
} as const;

const coalescedLoopWGSL = (
  providedOptions: coalescedLoopWGSLOptions
): WGSLStatements => {

  const options = optionize3<coalescedLoopWGSLOptions>()( {}, COALESCED_LOOP_DEFAULT_OPTIONS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const lengthExpression = options.lengthExpression;
  const callback = options.callback;

  return `
    ${unrollWGSL( 0, options.grainSize, i => `
      {
        let coalesced_local_index = ${u32( i * workgroupSize )} + ${options.localIndex};
        let coalesced_data_index = ${options.workgroupIndex} * ${u32( workgroupSize * grainSize )} + coalesced_local_index;
        ${conditionalIfWGSL( lengthExpression ? `coalesced_data_index < ${lengthExpression}` : null, `
          ${callback( 'coalesced_local_index', 'coalesced_data_index' )}
        ` )}
      }
    ` )}
  `;
};

export default coalescedLoopWGSL;

alpenglow.register( 'coalescedLoopWGSL', coalescedLoopWGSL );
