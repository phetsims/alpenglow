// Copyright 2023, University of Colorado Boulder

/**
 * Convert to an exclusive scan with the different indices
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

fn inclusive_to_exclusive_scan_indices( index: u32, workgroupSize: u32 ) -> vec3u {
  let index0 = index / workgroupSize;
  let index1 = index0 / workgroupSize;
  let index2 = index1 / workgroupSize;

  return vec3( index0 - 1u, index1 - 1u, index2 - 1u );
}
