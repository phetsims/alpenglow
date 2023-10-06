// Copyright 2023, University of Colorado Boulder

/**
 * Takes the input reductions and computes the inclusive prefix sum (scan) into it, in a form that can be used for
 * computing the exclusive prefix sum (zeros the last element). Outputs the reduction of the entire input into the
 * output reduces.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterSplitReduceData
#import ./RasterStageConfig

#option workgroupSize

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;

// 0: split reduce 0
// 1: split reduce 1
// 2: edge reduce 0
// 3: edge reduce 1
@group(0) @binding(1)
var<uniform> reduce_number: vec4u; // Has the 16 bytes desired, x will hold the reduce number

@group(0) @binding(2)
var<storage, read_write> input_reduces: array<RasterSplitReduceData>; // mutated into scanned form
@group(0) @binding(3)
var<storage, read_write> output_reduces: array<RasterSplitReduceData>; // output in unscanned form

var<workgroup> reduces: array<RasterSplitReduceData,${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  // TODO: can we reduce register pressure by ditching the local variables for our IDs?

  // TODO: find a simpler way to do this
  var num_reduces = 0u;
  if ( reduce_number.x == 0u ) {
    num_reduces = config.split_reduce_scan_workgroup_x;
  }
  else if ( reduce_number.x == 1u ) {
    num_reduces = config.split_reduce0_workgroup_x;
  }
  else if ( reduce_number.x == 2u ) {
    num_reduces = config.edge_reduce_scan_workgroup_x;
  }
  else if ( reduce_number.x == 3u ) {
    num_reduces = config.edge_reduce0_workgroup_x;
  }

  let exists = global_id.x < num_reduces;

  var value = RasterSplitReduceData_identity;
  if ( exists ) {
    value = input_reduces[ global_id.x ];
  }

  reduces[ local_id.x ] = value;

  for ( var i = 0u; i < ${u32( Math.log2( workgroupSize ) )}; i++ ) {
    workgroupBarrier();

    let delta = 1u << i;
    if ( local_id.x >= delta ) {
      let other = reduces[ local_id.x - delta ];
      value = RasterSplitReduceData_combine( other, value );
    }

    workgroupBarrier();
    reduces[ local_id.x ] = value;
  }

  let is_last_in_workgroup = local_id.x == ${u32( workgroupSize - 1 )};

  if ( is_last_in_workgroup ) {
    // Set us up for "exclusive" scan, by zero-ing out the last entry
    output_reduces[ workgroup_id.x ] = value;
    input_reduces[ global_id.x ] = RasterSplitReduceData_identity;
  }
  else {
    input_reduces[ global_id.x ] = value;
  }
}
