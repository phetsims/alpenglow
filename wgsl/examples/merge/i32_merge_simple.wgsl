// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/merge_simple

#option workgroupSize
#option grainSize
#option sizeA
#option sizeB


@group(0) @binding(0)
var<storage> a: array<i32>;
@group(0) @binding(1)
var<storage> b: array<i32>;
@group(0) @binding(2)
var<storage, read_write> c: array<i32>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${merge_simple( {
    lengthA: u32( sizeA ),
    lengthB: u32( sizeB ),
    setFromA: ( indexOutput, indexA ) => `c[ ${indexOutput} ] = a[ ${indexA} ];`,
    setFromB: ( indexOutput, indexB ) => `c[ ${indexOutput} ] = b[ ${indexB} ];`,
    grainSize: grainSize,
    compare: ( indexA, indexB ) => `a[ ${indexA} ] - b[ ${indexB} ]`,
    greaterThan: ( indexA, indexB ) => `a[ ${indexA} ] > b[ ${indexB} ]`,
    lessThanOrEqual: ( indexA, indexB ) => `a[ ${indexA} ] <= b[ ${indexB} ]`,
  } )}
}
