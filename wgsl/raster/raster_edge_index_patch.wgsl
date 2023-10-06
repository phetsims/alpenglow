// Copyright 2023, University of Colorado Boulder

/**
 * Updates the edges with the correct chunk indices (clippedChunk => outputChunk) and first/last flags.
 *
 * NOTE: It was possible to attempt to set first/last flags earlier (when we wrote the edges), but it would require
 * more traversal for edges that were fully clipped at the start/end (so they didn't contribute at all). We would
 * instead have to find the first/last "non-degenerate" EdgeClip, so it's just easier to do it here.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterStageConfig
#import ./RasterEdge

#option workgroupSize

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> chunk_index_map: array<u32>;
@group(0) @binding(2)
var<storage, read> chunk_indices: array<u32>;
@group(0) @binding(3)
var<storage, read_write> reducible_edges: array<RasterEdge>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  let edge_index = global_id.x;
  let exists = edge_index < config.num_reducible_edges;

  if ( exists ) {
    let edge = reducible_edges[ edge_index ];
    let clipped_chunk_index = edge.bits & RasterEdge_bits_chunk_index_mask;

    let output_chunk_index = chunk_index_map[ clipped_chunk_index ];

    let startIndex = chunk_indices[ 2u * clipped_chunk_index ];
    let endIndex = chunk_indices[ 2u * clipped_chunk_index + 1u ];

    reducible_edges[ edge_index ] = RasterEdge(
      output_chunk_index |
      select( 0u, RasterEdge_bits_is_first_edge_mask, edge_index == startIndex ) |
      select( 0u, RasterEdge_bits_is_last_edge_mask, edge_index == endIndex - 1u ),
      edge.startX,
      edge.startY,
      edge.endX,
      edge.endY
    );
  }
}
