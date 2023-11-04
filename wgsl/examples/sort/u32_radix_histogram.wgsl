// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/radix_histogram

#option workgroupSize
#option grainSize
#option inputSize
#option numBins

@group(0) @binding(0)
var<storage> input: array<u32>;
@group(0) @binding(1)
var<storage, read_write> output: array<u32>;

var<workgroup> histogram_scratch: array<atomic<u32>, ${numBins}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${radix_histogram( {
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    histogramScratch: `histogram_scratch`,
    getBin: index => `input[ ${index} ]`, // NOTE: using the u32s as their own bin
    numBins: numBins,
    length: u32( inputSize ),
    storeHistogram: ( index, value ) => `output[ ${index} ] = ${value};`
  } )}
}
