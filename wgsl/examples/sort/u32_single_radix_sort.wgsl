// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/single_radix_sort
#import ../../gpu/coalesced_loop
#import ../../gpu/unroll

#option workgroupSize
#option grainSize
#option inputSize
#option earlyLoad

@group(0) @binding(0)
var<storage> input: array<u32>;
@group(0) @binding(1)
var<storage, read_write> output: array<u32>;

var<workgroup> value_scratch: array<u32, ${workgroupSize * grainSize}>;
var<workgroup> bits_scratch: array<vec4u, ${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  // Read
  ${coalesced_loop( {
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: u32( inputSize ),
    callback: ( scratchIndex, dataIndex ) => `value_scratch[ ${scratchIndex} ] = input[ ${dataIndex} ];`,
  } )}

  workgroupBarrier();

  // Sort
  ${single_radix_sort( {
    valueType: 'u32',
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    numBits: 32,
    bitsScratch: `bits_scratch`,
    valueScratch: `value_scratch`,
    length: u32( inputSize ),
    getTwoBits: ( valueName, bitIndex ) => `( ( ( ${valueName} ) >> ( ${bitIndex} ) ) & 0x3u )`, // two-bit sort
    earlyLoad: earlyLoad,
  } )}

  // Write
  ${coalesced_loop( {
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: u32( inputSize ),
    callback: ( scratchIndex, dataIndex ) => `output[ ${dataIndex} ] = value_scratch[ ${scratchIndex} ];`,
  } )}
}
