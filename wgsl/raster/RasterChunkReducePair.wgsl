// Copyright 2023, University of Colorado Boulder

/**
 * Like RasterChunkReduceQuad, but for the initial case where our left/right values are the same, and we can do a
 * slightly different optimized reduce.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterChunkReduceData

struct RasterChunkReducePair {
  min: RasterChunkReduceData,
  max: RasterChunkReduceData
}

const RasterChunkReducePair_out_of_range = RasterChunkReducePair(
  RasterChunkReduceData_out_of_range,
  RasterChunkReduceData_out_of_range
);
