// Copyright 2023-2024, University of Colorado Boulder

/**
 * Calculates a histogram in shared (workgroup) memory by using atomics
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, COALESCED_LOOP_DEFAULTS, coalescedLoopWGSL, coalescedLoopWGSLOptions, commentWGSL, wgsl, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

type SelfOptions = {
  // var<workgroup> array<atomic<u32>, numBins> // TODO: can we actually get memory-compacted histograms here, instead of using a full u32?
  histogramScratch: WGSLVariableName;

  getBin: ( index: WGSLExpressionU32 ) => WGSLExpressionU32;
};

export type histogramWGSLOptions = SelfOptions & StrictOmit<coalescedLoopWGSLOptions, 'callback'>;

export const HISTOGRAM_DEFAULTS = {
  ...COALESCED_LOOP_DEFAULTS // eslint-disable-line phet/no-object-spread-on-non-literals
} as const;

const histogramWGSL = (
  providedOptions: histogramWGSLOptions
): WGSLStatements => {

  const options = optionize3<histogramWGSLOptions, SelfOptions>()( {}, HISTOGRAM_DEFAULTS, providedOptions );

  return wgsl`
    ${commentWGSL( 'begin histogram' )}
    {
      ${coalescedLoopWGSL( {
    workgroupSize: options.workgroupSize,
    grainSize: options.grainSize,
    lengthExpression: options.lengthExpression,
    workgroupIndex: options.workgroupIndex,
    localIndex: options.localIndex,
    callback: ( localIndex, dataIndex ) => wgsl`
          atomicAdd( &${options.histogramScratch}[ ${options.getBin( dataIndex )} ], 1u );
        `
  } )}
    }
    ${commentWGSL( 'end histogram' )}
  `;
};

export default histogramWGSL;

alpenglow.register( 'histogramWGSL', histogramWGSL );