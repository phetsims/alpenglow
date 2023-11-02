// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/workgroup_radix_sort

#option workgroupSize
#option inputSize

@group(0) @binding(0)
var<storage> input: array<u32>;
@group(0) @binding(1)
var<storage, read_write> output: array<u32>;

var<workgroup> value_scratch: array<u32, ${workgroupSize}>;
var<workgroup> bits_scratch: array<vec4u, ${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {

  var val = input[ global_id.x ];

  ${workgroup_radix_sort( {
    value: `val`,
    workgroupSize: workgroupSize,
    numBits: 32,
    bitsScratch: `bits_scratch`,
    valueScratch: `value_scratch`,
    length: u32( inputSize ),
    // NOTE: somewhat defensive with parentheses
    getTwoBits: ( valueName, bitIndex ) => `( ( ( ${valueName} ) >> ( ${bitIndex} ) ) & 0x3u )`,
  } )}

  workgroupBarrier();

  if ( global_id.x < ${u32( inputSize )} ) {
    output[ global_id.x ] = val;
  }
}
