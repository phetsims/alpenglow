// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/histogram
#import ../../gpu/unroll

#option workgroupSize
#option grainSize
#option inputSize
#option numBins

@group(0) @binding(0)
var<storage> input: array<u32>;
@group(0) @binding(1)
var<storage, read_write> output: array<atomic<u32>>;

var<workgroup> histogram_scratch: array<atomic<u32>, ${numBins}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {

  ${histogram( {
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    histogramScratch: `histogram_scratch`,
    getBin: index => `input[ ${index} ]`, // NOTE: using the u32s as their own bin
    length: u32( inputSize )
  } )}

  workgroupBarrier();

  // coalesced atomics
  ${unroll( 0, Math.ceil( numBins / workgroupSize ), i => `
    {
      let index = ${u32( workgroupSize * i )} + local_id.x;
      if ( index < ${u32( numBins )} ) {
        atomicAdd( &output[ index ], atomicLoad( &histogram_scratch[ index ] ) );
      }
    }
  ` )}
}
