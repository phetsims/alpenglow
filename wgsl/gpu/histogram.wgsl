// Copyright 2023, University of Colorado Boulder

/**
 * Calculates a histogram in shared (workgroup) memory by using atomics
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./coalesced_loop

${template( ( {
  workgroupSize, // number
  grainSize, // number
  histogramScratch, // var<workgroup> array<atomic<u32>, numBins> // TODO: can we actually get memory-compacted histograms here, instead of using a full u32?
  getBin, // ( index ) => u32
  length, // expression: u32
} ) => `
  {
    ${coalesced_loop( {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      length: length,
      callback: ( localIndex, dataIndex ) => `
        atomicAdd( &${histogramScratch}[ ${getBin( dataIndex )} ], 1u );
      `
    } )}
  }
` )}
