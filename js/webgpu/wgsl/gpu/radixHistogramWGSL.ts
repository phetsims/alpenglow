// Copyright 2023-2024, University of Colorado Boulder

/**
 * Calculates a histogram for a section, then writes the histogram out in a striped manner ready for a prefix sum.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ceilDivideConstantDivisorWGSL, commentWGSL, histogramWGSL, histogramWGSLOptions, u32, unrollWGSL, PipelineBlueprint, WGSLExpressionU32, WGSLStatements, logRakedWGSL, U32Type } from '../../../imports.js';
import WithoutNull from '../../../../../phet-core/js/types/WithoutNull.js';
import WithRequired from '../../../../../phet-core/js/types/WithRequired.js';

export type radixHistogramWGSLOptions = {
  numBins: number;

  // indices up to numBins * Math.ceil( length / ( workgroupSize * grainSize ) )
  storeHistogram: ( blueprint: PipelineBlueprint, index: WGSLExpressionU32, value: WGSLExpressionU32 ) => WGSLStatements;
} & WithoutNull<WithRequired<histogramWGSLOptions, 'lengthExpression'>, 'lengthExpression'>;

const radixHistogramWGSL = (
  blueprint: PipelineBlueprint,
  options: radixHistogramWGSLOptions
): WGSLStatements => {

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const lengthExpression = options.lengthExpression;
  const numBins = options.numBins;
  const storeHistogram = options.storeHistogram;

  return `
    ${commentWGSL( 'begin radix_histogram' )}
  
    {
      ${histogramWGSL( blueprint, options )}
      
      ${logRakedWGSL( blueprint, {
        name: 'histogram_scratch',
        type: U32Type,
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        relativeLengthExpression: u32( workgroupSize * grainSize ),
        relativeAccessExpression: i => `atomicLoad( &histogram_scratch[ ${i} ] )`
      } )}
      
      let num_valid_workgroups = ${ceilDivideConstantDivisorWGSL( lengthExpression( blueprint ), workgroupSize * grainSize )};
      if ( workgroup_id.x < num_valid_workgroups ) {
        // Should be uniform control flow for the workgroup
        workgroupBarrier();
  
        ${unrollWGSL( 0, Math.ceil( numBins / workgroupSize ), i => `
          {
            let local_index = ${u32( workgroupSize * i )} + local_id.x;
            if ( local_index < ${u32( numBins )} ) {
              ${storeHistogram( blueprint, 'local_index * num_valid_workgroups + workgroup_id.x', 'atomicLoad( &histogram_scratch[ local_index ] )' )}
            }
          }
        ` )}
      }
    }
  
    ${commentWGSL( 'end radix_histogram' )}
  `;
};

export default radixHistogramWGSL;

alpenglow.register( 'radixHistogramWGSL', radixHistogramWGSL );
