// Copyright 2023, University of Colorado Boulder

/**
 * Calculates a histogram for a section, then writes the histogram out in a striped manner ready for a prefix sum.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./histogram
#import ./unroll
#import ./ceil_divide_constant_divisor

${template( ( {
  workgroupSize, // number
  grainSize, // number
  histogramScratch, // var<workgroup> array<atomic<u32>, numBins>
  numBins, // number
  getBin, // ( index ) => u32
  length, // expression: u32

  // ( index, value ) => void -- statement
  // indices up to numBins * Math.ceil( length / ( workgroupSize * grainSize ) )
  storeHistogram,
} ) => `
  ${comment( 'begin radix_histogram' )}

  {
    ${histogram( {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      histogramScratch: histogramScratch,
      getBin: getBin,
      length: length,
    } )}

    let num_valid_workgroups = ${ceil_divide_constant_divisor( length, workgroupSize * grainSize )};
    if ( workgroup_id.x < num_valid_workgroups ) {
      // Should be uniform control flow for the workgroup
      workgroupBarrier();

      ${unroll( 0, Math.ceil( numBins / workgroupSize ), i => `
        {
          let local_index = ${u32( workgroupSize * i )} + local_id.x;
          if ( local_index < ${u32( numBins )} ) {
            ${storeHistogram( `local_index * num_valid_workgroups + workgroup_id.x`, `atomicLoad( &histogram_scratch[ local_index ] )` )}
          }
        }
      ` )}
    }
  }

  ${comment( 'end radix_histogram' )}
` )}
