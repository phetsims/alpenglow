// Copyright 2023, University of Colorado Boulder

/**
 * A specialized raked reduce for when our input is non-commutative AND stored in a blocked (not striped) order.
 * We essentially serialize some of it (reading a workgroup-size chunk at a time, reducing it, then loading the next).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./reduce
#import ./unroll
#import ./binary_expression_statement
#import ./to_striped_index

#option workgroupSize
#option grainSize
#option length
#option identity
#option combineExpression
#option combineStatements
#option valueType
#option factorOutSubexpressions
#option nestSubexpressions

// We can stripe the output (so the next layer of reduce can read it as striped)
#option stripeOutput

@group(0) @binding(0)
var<storage> input: array<${valueType}>;
@group(0) @binding(1)
var<storage, read_write> output: array<${valueType}>;

var<workgroup> scratch: array<${valueType}, ${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  // TODO: we can probably accomplish this with smarter use of the local variables
  if ( local_id.x == 0u ) {
    scratch[ 0u ] = ${identity};
  }

  var value: ${valueType};
  ${unroll( 0, grainSize, ( i, isFirst, isLast ) => {
    const combineToValue = ( varName, a, b ) => binary_expression_statement( varName, combineExpression, combineStatements, a, b );

    return `
      {
        value = input[ workgroup_id.x * ${u32( workgroupSize * grainSize )} + ${u32( i * workgroupSize )} + local_id.x ];
        if ( local_id.x == 0u ) {
          ${combineToValue( `value`, `scratch[ 0u ]`, `value` )}
        }

        ${reduce( {
          value: 'value',
          scratch: 'scratch',
          workgroupSize: workgroupSize,
          identity: identity,
          combineExpression: combineExpression,
          combineStatements: combineStatements
        } )}

        ${!isLast ? `
          if ( local_id.x == 0u ) {
            scratch[ 0u ] = value;
          }
        ` : ``}
      }
    `;
  } )}

  if ( local_id.x == 0u ) {
    output[ ${stripeOutput ? to_striped_index( {
      i: `workgroup_id.x`,
      workgroupSize: workgroupSize,
      grainSize: grainSize
    } ) : `workgroup_id.x`} ] = value;
  }
}
