// Copyright 2023-2024, University of Colorado Boulder

/**
 * A simple unrolled loop that provides both a "blocked" and "striped" (coalesced) index for each iteration.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import { alpenglow, conditionalIfWGSL, LOCAL_INDEXABLE_DEFAULTS, LocalIndexable, OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS, OptionalLengthExpressionable, RakedSizable, u32S, unrollWGSL, wgsl, WGSLExpressionU32, WGSLStatements, WORKGROUP_INDEXABLE_DEFAULTS, WorkgroupIndexable } from '../../../imports.js';

export type coalescedLoopWGSLOptions = {
  callback: ( localIndex: WGSLExpressionU32, dataIndex: WGSLExpressionU32 ) => WGSLStatements;
} & RakedSizable & OptionalLengthExpressionable & WorkgroupIndexable & LocalIndexable;

export const COALESCED_LOOP_DEFAULTS = {
  ...OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS, // eslint-disable-line phet/no-object-spread-on-non-literals
  ...WORKGROUP_INDEXABLE_DEFAULTS, // eslint-disable-line phet/no-object-spread-on-non-literals
  ...LOCAL_INDEXABLE_DEFAULTS // eslint-disable-line phet/no-object-spread-on-non-literals
} as const;

const coalescedLoopWGSL = (
  providedOptions: coalescedLoopWGSLOptions
): WGSLStatements => {

  const options = optionize3<coalescedLoopWGSLOptions>()( {}, COALESCED_LOOP_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const lengthExpression = options.lengthExpression;
  const callback = options.callback;

  return wgsl`
    ${unrollWGSL( 0, options.grainSize, i => wgsl`
      {
        let coalesced_local_index = ${u32S( i * workgroupSize )} + ${options.localIndex};
        let coalesced_data_index = ${options.workgroupIndex} * ${u32S( workgroupSize * grainSize )} + coalesced_local_index;
        ${conditionalIfWGSL( lengthExpression ? wgsl`coalesced_data_index < ${lengthExpression}` : null, wgsl`
          ${callback( wgsl`coalesced_local_index`, wgsl`coalesced_data_index` )}
        ` )}
      }
    ` )}
  `;
};

export default coalescedLoopWGSL;

alpenglow.register( 'coalescedLoopWGSL', coalescedLoopWGSL );