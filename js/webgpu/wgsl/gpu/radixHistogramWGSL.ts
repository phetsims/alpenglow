// Copyright 2023-2025, University of Colorado Boulder

/**
 * Calculates a histogram for a section, then writes the histogram out in a striped manner ready for a prefix sum.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import WithoutNull from '../../../../../phet-core/js/types/WithoutNull.js';
import WithRequired from '../../../../../phet-core/js/types/WithRequired.js';
import { alpenglow } from '../../../alpenglow.js';
import { u32S, wgsl, WGSLExpressionU32, WGSLStatements } from '../WGSLString.js';
import { histogramWGSL, histogramWGSLOptions } from './histogramWGSL.js';
import { commentWGSL } from './commentWGSL.js';
import { logRakedWGSL } from './logRakedWGSL.js';
import { U32Type } from '../../compute/ConcreteType.js';
import { ceilDivideConstantDivisorWGSL } from './ceilDivideConstantDivisorWGSL.js';
import { unrollWGSL } from './unrollWGSL.js';

export type radixHistogramWGSLOptions = {
  numBins: number;

  // indices up to numBins * Math.ceil( length / ( workgroupSize * grainSize ) )
  storeHistogram: ( index: WGSLExpressionU32, value: WGSLExpressionU32 ) => WGSLStatements;
} & WithoutNull<WithRequired<histogramWGSLOptions, 'lengthExpression'>, 'lengthExpression'>;

export const radixHistogramWGSL = (
  options: radixHistogramWGSLOptions
): WGSLStatements => {

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const lengthExpression = options.lengthExpression;
  const numBins = options.numBins;
  const storeHistogram = options.storeHistogram;

  return wgsl`
    ${commentWGSL( 'begin radix_histogram' )}
  
    {
      ${histogramWGSL( options )}
      
      ${logRakedWGSL( {
        name: 'histogram_scratch',
        type: U32Type,
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        relativeLengthExpression: u32S( workgroupSize * grainSize ),
        relativeAccessExpression: i => wgsl`atomicLoad( &histogram_scratch[ ${i} ] )`
      } )}
      
      let num_valid_workgroups = ${ceilDivideConstantDivisorWGSL( lengthExpression, workgroupSize * grainSize )};
      if ( workgroup_id.x < num_valid_workgroups ) {
        // Should be uniform control flow for the workgroup
        workgroupBarrier();
  
        ${unrollWGSL( 0, Math.ceil( numBins / workgroupSize ), i => wgsl`
          {
            let local_index = ${u32S( workgroupSize * i )} + local_id.x;
            if ( local_index < ${u32S( numBins )} ) {
              ${storeHistogram( wgsl`local_index * num_valid_workgroups + workgroup_id.x`, wgsl`atomicLoad( &histogram_scratch[ local_index ] )` )}
            }
          }
        ` )}
      }
    }
  
    ${commentWGSL( 'end radix_histogram' )}
  `;
};

alpenglow.register( 'radixHistogramWGSL', radixHistogramWGSL );