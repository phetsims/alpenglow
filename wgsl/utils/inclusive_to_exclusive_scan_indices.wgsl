// Copyright 2023, University of Colorado Boulder

/**
 * Convert to an exclusive scan with the different indices
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

fn inclusive_to_exclusive_scan_indices( index: u32, workgroupSize: u32 ) -> vec3i {
  let index0 = index / workgroupSize;
  let index1 = index0 / workgroupSize;
  let index2 = index1 / workgroupSize;

  return vec3( i32( index0 ) - 1i, i32( index1 ) - 1i, i32( index2 ) - 1i );
}
