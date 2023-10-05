// Copyright 2023, University of Colorado Boulder

/**
 * A pair of counts (reducible/complete).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

struct RasterSplitReduceData {
  numReducible: u32,
  numComplete: u32
}

const RasterSplitReduceData_identity = RasterSplitReduceData( 0u, 0u );
