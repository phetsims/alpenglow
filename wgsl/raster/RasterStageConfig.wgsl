// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// TODO: is our uniform being large an... issue? keep it smaller?
struct RasterStageConfig {
  // We start with indirect dispatch sizes, so they are easy to index

  // 0-byte offset
  initial_chunk_workgroup_x: u32, // Math.ceil( num_input_chunks / workgroupSize )
  initial_chunk_workgroup_y: u32,
  initial_chunk_workgroup_z: u32,

  // 12-byte offset (initial_clip, AND edge_index_patch AFTER the update)
  initial_clip_workgroup_x: u32, // Math.ceil( num_input_edges / workgroupSize )
  initial_clip_workgroup_y: u32,
  initial_clip_workgroup_z: u32,

  // 24-byte offset
  chunk_reduce_0_workgroup_x: u32, // Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) )
  chunk_reduce_0_workgroup_y: u32,
  chunk_reduce_0_workgroup_z: u32,

  // 36-byte offset
  chunk_reduce_1_workgroup_x: u32, // Math.ceil( numInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) )
  chunk_reduce_1_workgroup_y: u32,
  chunk_reduce_1_workgroup_z: u32,

  // 48-byte offset (initial_split_reduce / split_scan / chunk_index_patch)
  split_reduce_scan_workgroup_x: u32, // Math.ceil( numClippedChunks / workgroupSize )
  split_reduce_scan_workgroup_y: u32,
  split_reduce_scan_workgroup_z: u32,

  // 60-byte offset (initial_edge_reduce / edge_scan)
  edge_reduce_scan_workgroup_x: u32, // Math.ceil( numEdgeClips / workgroupSize )
  edge_reduce_scan_workgroup_y: u32,
  edge_reduce_scan_workgroup_z: u32,

  // 72-byte offset
  split_reduce0_workgroup_x: u32, // Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) )
  split_reduce0_workgroup_y: u32,
  split_reduce0_workgroup_z: u32,

  // 84-byte offset
  split_reduce1_workgroup_x: u32, // Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) )
  split_reduce1_workgroup_y: u32,
  split_reduce1_workgroup_z: u32,

  // 96-byte offset
  edge_reduce0_workgroup_x: u32, // Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) )
  edge_reduce0_workgroup_y: u32,
  edge_reduce0_workgroup_z: u32,

  // 108-byte offset
  edge_reduce1_workgroup_x: u32, // Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) )
  edge_reduce1_workgroup_y: u32,
  edge_reduce1_workgroup_z: u32,

  // 30-word offset
  num_input_chunks: u32,
  num_input_edges: u32,
  num_clipped_chunks: u32, // 2x num_input_chunks, but here for simplicity
  num_edge_clips: u32, // 2x num_input_edges, but here for simplicity

  // Will be filled in AND read in the single stage
  num_reducible_chunks: u32,
  num_complete_chunks: u32,
  num_reducible_edges: u32,
  num_complete_edges: u32

  // 38 word length
}
