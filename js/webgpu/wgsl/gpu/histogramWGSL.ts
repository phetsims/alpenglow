// Copyright 2023, University of Colorado Boulder

/**
 * Calculates a histogram in shared (workgroup) memory by using atomics
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, coalescedLoopWGSL, coalescedLoopWGSLOptions, commentWGSL, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type histogramWGSLOptions = {
  workgroupSize: number;
  grainSize: number;

  // var<workgroup> array<atomic<u32>, numBins> // TODO: can we actually get memory-compacted histograms here, instead of using a full u32?
  histogramScratch: WGSLVariableName;

  getBin: ( index: WGSLExpressionU32 ) => WGSLExpressionU32;

  lengthExpression?: WGSLExpressionU32 | null;
} & Pick<coalescedLoopWGSLOptions, 'workgroupIndex' | 'localIndex'>;

type SelfOptions = Pick<histogramWGSLOptions, 'histogramScratch' | 'getBin'>;

const DEFAULT_OPTIONS = {
  lengthExpression: null
} as const;

const histogramWGSL = (
  providedOptions: histogramWGSLOptions
): WGSLStatements => {

  const options = optionize3<histogramWGSLOptions, SelfOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

  const histogramScratch = options.histogramScratch;
  const getBin = options.getBin;

  return `
    ${commentWGSL( 'begin histogram' )}
    {
      ${coalescedLoopWGSL( {
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        lengthExpression: options.lengthExpression,
        workgroupIndex: options.workgroupIndex,
        localIndex: options.localIndex,
        callback: ( localIndex, dataIndex ) => `
          atomicAdd( &${histogramScratch}[ ${getBin( dataIndex )} ], 1u );
        `
      } )}
    }
    ${commentWGSL( 'end histogram' )}
  `;
};

export default histogramWGSL;

alpenglow.register( 'histogramWGSL', histogramWGSL );
