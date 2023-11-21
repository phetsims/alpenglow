// Copyright 2023, University of Colorado Boulder

/**
 * Shader to bump a shader "barrier" note into the log buffer
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./log

#bindings

@compute @workgroup_size(1)
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${log( {
    name: null
  } )}
}
