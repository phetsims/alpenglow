// Copyright 2023, University of Colorado Boulder

/**
 * Calculates a histogram in shared (workgroup) memory by using atomics
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, coalescedLoopWGSL, commentWGSL, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type histogramWGSLOptions = {
  workgroupSize: number;
  grainSize: number;

  // var<workgroup> array<atomic<u32>, numBins> // TODO: can we actually get memory-compacted histograms here, instead of using a full u32?
  histogramScratch: WGSLVariableName;

  getBin: ( index: WGSLExpressionU32 ) => WGSLExpressionU32;

  length?: WGSLExpressionU32 | null; // TODO: rename to lengthExpression
};

const DEFAULT_OPTIONS = {
  length: null
} as const;

const histogramWGSL = (
  providedOptions: histogramWGSLOptions
): WGSLStatements => {

  const options = optionize3<histogramWGSLOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const histogramScratch = options.histogramScratch;
  const getBin = options.getBin;
  const length = options.length;

  return `
    ${commentWGSL( 'begin histogram' )}
    {
      ${coalescedLoopWGSL( {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        length: length,
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
