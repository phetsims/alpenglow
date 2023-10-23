// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../gpu/right_scan

#option workgroupSize
#option grainSize
#option inputSize

#option identity
#option combine

@group(0) @binding(0)
var<storage> input: array<f32>;
@group(0) @binding(1)
var<storage, read_write> output: array<f32>;

var<workgroup> scratch: array<f32, ${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  // TODO: have conditional range checks (if we have no range check, that is nice)
  var workgroup_base = workgroup_id.x * ${u32( workgroupSize * grainSize )};
  var striped_base = workgroup_base + local_id.x;
  var blocked_base = workgroup_base + local_id.x * ${u32( grainSize )};
  var value = select( ${identity}, input[ striped_base ], blocked_base < ${u32( inputSize )});

  // TODO: compute the maximum i value based on the inputSize (don't need further checks inside)
  // TODO: how to unroll? nested if statements? how can we do it without branches?
  for ( var i = 1u; i < ${u32( grainSize )}; i++ ) {
    value = ${combine( `value`, `select( ${identity}, input[ striped_base + i * ${u32( workgroupSize )} ], blocked_base + i < ${u32( inputSize )} )` )};
  }
  // TODO: unroll these?

  ${right_scan( {
    value: 'value',
    scratch: 'scratch',
    workgroupSize: workgroupSize,
    identity: identity,
    combine: combine,
    skipLastScratch: true
  } )}

  if ( local_id.x == 0u ) {
    output[ workgroup_id.x ] = value;
  }
}
