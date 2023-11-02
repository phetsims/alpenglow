// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/single_radix_sort
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
  // TODO: have a template function for this!!!
  // coalesced loads
  ${unroll( 0, grainSize, i => `
    {
      let local_index = ${u32( i * workgroupSize )} + local_id.x;
      let global_index = workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_index;
      if ( global_index < ${u32( inputSize )} ) {
        value_scratch[ local_index ] = input[ workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_index ];
      }
    }
  ` )}

  ${single_radix_sort( {
    valueType: 'u32',
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    numBits: 32,
    bitsScratch: `bits_scratch`,
    valueScratch: `value_scratch`,
    length: u32( inputSize ),
    // NOTE: somewhat defensive with parentheses
    getTwoBits: ( valueName, bitIndex ) => `( ( ( ${valueName} ) >> ( ${bitIndex} ) ) & 0x3u )`,
    earlyLoad: earlyLoad,
  } )}

  // TODO: coalesced writes
  ${unroll( 0, grainSize, i => `
    {
      let local_index = ${u32( i * workgroupSize )} + local_id.x;
      let global_index = workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_index;
      if ( global_index < ${u32( inputSize )} ) {
        output[ workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_index ] = value_scratch[ local_index ];
      }
    }
  ` )}
}
