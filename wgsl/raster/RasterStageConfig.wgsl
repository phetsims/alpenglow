// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

struct RasterStageConfig {
  num_input_chunks: u32,
  num_input_edges: u32,

  num_clipped_chunks: u32, // 2x num_input_chunks, but here for simplicity
  num_edge_clips: u32, // 2x num_input_edges, but here for simplicity

  // 16-byte offset
  initial_chunk_workgroup_x: u32, // Math.ceil( num_input_chunks / workgroupSize )
  initial_chunk_workgroup_y: u32,
  initial_chunk_workgroup_z: u32,

  // 28-byte offset
  initial_clip_workgroup_x: u32, // Math.ceil( num_input_edges / workgroupSize )
  initial_clip_workgroup_y: u32,
  initial_clip_workgroup_z: u32,
}
