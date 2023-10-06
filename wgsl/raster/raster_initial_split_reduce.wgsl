// Copyright 2023, University of Colorado Boulder

/**
 * Calculates the initial splits (reducible/complete counts) for each clipped chunk, and applies the first level of
 * reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// TODO: see what imports we can ditch
#import ./RasterClippedChunk
#import ./RasterChunkReduceQuad
#import ./RasterStageConfig
#import ./clipped_chunk_info

#option workgroupSize

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> clipped_chunks: array<RasterClippedChunk>;
@group(0) @binding(2)
var<storage, read_write> split_reduces: array<RasterSplitReduceData>; // written only
#ifdef debugReduceBuffers
@group(0) @binding(3)
var<storage, read_write> debug_reduces: array<RasterSplitReduceData>;
#endif

var<workgroup> reduces: array<RasterSplitReduceData,${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  let chunk_index = global_id.x;
  let exists = chunk_index < config.num_clipped_chunks;

  let clipped_chunk = clipped_chunks[ chunk_index ];

  var value = RasterSplitReduceData_identity;
  if ( exists ) {
    value = RasterClippedChunk_get_data( clipped_chunk );
  }

  reduces[ local_id.x ] = value;

#ifdef debugReduceBuffers
  debug_reduces[ global_id.x ] = value;
#endif

  for ( var i = 0u; i < ${u32( Math.log2( workgroupSize ) )}; i++ ) {
    workgroupBarrier();

    let delta = 1u << i;
    if ( local_id.x >= delta ) {
      let other = reduces[ local_id.x - delta ];
      value = RasterSplitReduceData_combine( other, value );
    }

    workgroupBarrier();
    reduces[ local_id.x ] = value;
  }

  if ( local_id.x == ${u32( workgroupSize - 1 )} ) {
    split_reduces[ workgroup_id.x ] = value;
  }
}
