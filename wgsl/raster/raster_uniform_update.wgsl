// Copyright 2023, University of Colorado Boulder

/**
 * Updates our RasterStageConfig with new counts, and prepopulates the workgroup dispatch sizes for the next stage.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterStageConfig
#import ./RasterSplitReduceData

#option workgroupSize

@group(0) @binding(0)
var<storage, read> split_reduces: array<RasterSplitReduceData>;
@group(0) @binding(1)
var<storage, read> edge_reduces: array<RasterSplitReduceData>;
@group(0) @binding(2)
var<storage, read_write> config: RasterStageConfig;

#bindings

fn divide_round_up( a: u32, b: u32 ) -> u32 {
  return ( a + b - 1u ) / b;
}

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  let split_reduce = split_reduces[ 0u ];
  let edge_reduce = edge_reduces[ 0u ];

  let num_reducible_chunks = split_reduce.numReducible;
  let num_complete_chunks = split_reduce.numComplete;
  let num_reducible_edges = edge_reduce.numReducible;
  let num_complete_edges = edge_reduce.numComplete;

  // Renaming for ease of things
  let num_input_chunks = num_reducible_chunks;
  let num_input_edges = num_reducible_edges;
  let num_clipped_chunks = 2u * num_input_chunks;
  let num_edge_clips = 2u * num_input_edges;

  let workgroup_size = ${u32( workgroupSize )};

  // NOTE: Not simplified for clarity (could simplify later if needed).
  config = RasterStageConfig(
    // initial_chunk_workgroup
    divide_round_up( num_input_chunks, workgroup_size ), 1u, 1u,

    // initial_clip_workgroup
    divide_round_up( num_input_edges, workgroup_size ), 1u, 1u,

    // chunk_reduce_0_workgroup
    divide_round_up( num_input_edges, workgroup_size * workgroup_size ), 1u, 1u,

    // chunk_reduce_1_workgroup
    divide_round_up( num_input_edges, workgroup_size * workgroup_size * workgroup_size ), 1u, 1u,

    // split_reduce_scan_workgroup
    divide_round_up( num_clipped_chunks, workgroup_size ), 1u, 1u,

    // edge_reduce_scan_workgroup
    divide_round_up( num_edge_clips, workgroup_size ), 1u, 1u,

    // split_reduce0_workgroup
    divide_round_up( num_clipped_chunks, workgroup_size * workgroup_size ), 1u, 1u,

    // split_reduce1_workgroup
    divide_round_up( num_clipped_chunks, workgroup_size * workgroup_size * workgroup_size ), 1u, 1u,

    // edge_reduce0_workgroup
    divide_round_up( num_edge_clips, workgroup_size * workgroup_size ), 1u, 1u,

    // edge_reduce1_workgroup
    divide_round_up( num_edge_clips, workgroup_size * workgroup_size * workgroup_size ), 1u, 1u,

    num_input_chunks,
    num_input_edges,

    num_clipped_chunks,
    num_edge_clips,

    num_reducible_chunks,
    num_complete_chunks,
    num_reducible_edges,
    num_complete_edges
  );
}
