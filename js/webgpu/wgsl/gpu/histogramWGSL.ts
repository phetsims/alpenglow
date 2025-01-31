// Copyright 2023-2025, University of Colorado Boulder

/**
 * Calculates a histogram in shared (workgroup) memory by using atomics
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import { alpenglow } from '../../../alpenglow.js';
import { wgsl, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../WGSLString.js';
import { COALESCED_LOOP_DEFAULTS, coalescedLoopWGSL, coalescedLoopWGSLOptions } from './coalescedLoopWGSL.js';
import { commentWGSL } from './commentWGSL.js';

type SelfOptions = {
  // var<workgroup> array<atomic<u32>, numBins> // TODO: can we actually get memory-compacted histograms here, instead of using a full u32?
  histogramScratch: WGSLVariableName;

  getBin: ( index: WGSLExpressionU32 ) => WGSLExpressionU32;
};

export type histogramWGSLOptions = SelfOptions & StrictOmit<coalescedLoopWGSLOptions, 'callback'>;

export const HISTOGRAM_DEFAULTS = {
  ...COALESCED_LOOP_DEFAULTS // eslint-disable-line phet/no-object-spread-on-non-literals
} as const;

export const histogramWGSL = (
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

alpenglow.register( 'histogramWGSL', histogramWGSL );