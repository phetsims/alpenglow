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
  let baseIndex = ${u32( grainSize )} * global_id.x;
  var value = select( ${identity}, input[ baseIndex ], baseIndex < ${u32( inputSize )} );
  // TODO: compute the maximum i value based on the inputSize (don't need further checks inside)
  // TODO: how to unroll? nested if statements? how can we do it without branches?
  for ( var i = 1u; i < ${u32( grainSize )}; i++ ) {
    value = ${combine( `value`, `select( ${identity}, input[ baseIndex + i ], baseIndex + i < ${u32( inputSize )} )` )};
  }

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
