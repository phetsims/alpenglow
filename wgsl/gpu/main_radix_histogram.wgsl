// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./radix_histogram

#option workgroupSize
#option grainSize
#option valueType
#option length
#option bitQuantity

// ( value ) => bits
#option getBits

@group(0) @binding(0)
var<storage> input: array<${valueType}>;
@group(0) @binding(1)
var<storage, read_write> output: array<u32>;

var<workgroup> histogram_scratch: array<atomic<u32>, ${2 ** bitQuantity}>;

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
    getBin: index => getBits( `input[ ${index} ]` ), // TODO: consider rename of getBin
    numBins: 2 ** bitQuantity,
    length: length,
    storeHistogram: ( index, value ) => `output[ ${index} ] = ${value};`
  } )}
}
