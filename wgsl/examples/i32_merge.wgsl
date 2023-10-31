// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../gpu/merge

#option workgroupSize
#option sharedMemorySize
#option blockOutputSize
#option lengthA
#option lengthB

@group(0) @binding(0)
var<storage> a: array<i32>;
@group(0) @binding(1)
var<storage> b: array<i32>;
@group(0) @binding(2)
var<storage, read_write> c: array<i32>;

var<workgroup> scratch_a: array<i32,${sharedMemorySize}>;
var<workgroup> scratch_b: array<i32,${sharedMemorySize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${merge( {
    workgroupA: `scratch_a`,
    workgroupB: `scratch_b`,
    loadFromA: indexA => `scratch_a[ ${indexA} ]`,
    loadFromB: indexB => `scratch_b[ ${indexB} ]`,
    storeOutput: ( indexOutput, value ) => `c[ ${indexOutput} ] = ${value};`,
    lengthA: u32( lengthA ),
    lengthB: u32( lengthB ),
    workgroupSize: workgroupSize,
    blockOutputSize: blockOutputSize,
    sharedMemorySize: sharedMemorySize,
    compare: ( valueA, valueB ) => `${valueA} - ${valueB}`,
    greaterThan: ( valueA, valueB ) => `${valueA} > ${valueB}`,
    lessThanOrEqual: ( valueA, valueB ) => `${valueA} <= ${valueB}`
  } )}
}
