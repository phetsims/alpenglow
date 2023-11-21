// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./comment
#import ./conditional_if
#import ./scan_raked
#import ./unroll
#import ./ceil_divide_constant_divisor
#import ./load_multiple
#import ./n_bit_compact_single_sort
#import ./log

#option workgroupSize
#option grainSize
#option valueType
#option length
#option factorOutSubexpressions
#option bitQuantity
#option innerBitQuantity
#option innerBitVectorSize
#option earlyLoad

// TODO: support statements?
// ( value ) => bits
#option getBits

@group(0) @binding(0)
var<storage> input: array<${valueType}>;
@group(0) @binding(1)
var<storage> histogram_offsets: array<u32>;
@group(0) @binding(2)
var<storage, read_write> output: array<u32>;

// TODO: see how we can potentially reuse some memory?
var<workgroup> bits_scratch: array<${{ 1: 'u32', 2: 'vec2u', 3: 'vec3u', 4: 'vec4u' }[ innerBitVectorSize ]}, ${workgroupSize}>;
var<workgroup> value_scratch: array<${valueType}, ${workgroupSize * grainSize}>;
var<workgroup> local_histogram_offsets: array<u32, ${u32( 2 ** bitQuantity )}>;
var<workgroup> start_indices: array<u32, ${workgroupSize * grainSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${log( {
    name: 'main_radix_scatter start'
  } )}

  let num_valid_workgroups = ${ceil_divide_constant_divisor( length, workgroupSize * grainSize )};

  ${log( {
    name: 'num_valid_workgroups',
    dataLength: 1,
    writeU32s: ( arr, offset ) => `${arr}[ ${offset} ] = num_valid_workgroups;`,
    deserialize: arr => arr[ 0 ],
  } )}

  if ( workgroup_id.x < num_valid_workgroups ) {
    ${load_multiple( {
      loadExpression: index => `input[ ${index} ]`,
      storeStatements: ( index, value ) => `value_scratch[ ${index} ] = ${value};`,
      valueType: valueType,
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      length: length,
      outOfRangeValue: null,
      inputOrder: 'blocked',
      inputAccessOrder: 'striped',
      factorOutSubexpressions: factorOutSubexpressions,
    } )}

    ${log( {
      name: 'initial data',
      dataLength: grainSize,
      writeU32s: ( arr, offset ) => `
        workgroupBarrier();
        ${unroll( 0, grainSize, i => `
          ${arr}[ ${offset} + ${u32( i )} ] = value_scratch[ ${u32( grainSize )} * local_id.x + ${u32( i )} ];
        `)}
      `,
      deserialize: arr => [ ...arr ],
    } )}

    ${comment( 'begin load histogram offsets' )}
    ${unroll( 0, Math.ceil( ( 2 ** bitQuantity ) / workgroupSize ), i => `
      {
        let local_index = ${u32( workgroupSize * i )} + local_id.x;
        if ( local_index < ${u32( 2 ** bitQuantity )} ) {
          local_histogram_offsets[ local_index ] = histogram_offsets[ local_index * num_valid_workgroups + workgroup_id.x ];
        }
      }
    ` )}
    ${comment( 'end load histogram offsets' )}

    ${log( {
      name: 'scanned histogram',
      dataLength: Math.ceil( ( 2 ** bitQuantity ) / workgroupSize ),
      writeU32s: ( arr, offset ) => `
        workgroupBarrier();
        ${unroll( 0, Math.ceil( ( 2 ** bitQuantity ) / workgroupSize ), i => `
          ${arr}[ ${offset} + ${u32( i )} ] = histogram_offsets[ ${u32( Math.ceil( ( 2 ** bitQuantity ) / workgroupSize ) )} * local_id.x + ${u32( i )} ];
        `)}
      `,
      deserialize: arr => [ ...arr ],
    } )}

    // Our workgroupBarrier will apply for value_scratch AND local_histogram_offsets
    workgroupBarrier();

    ${length ? `
      let reduced_length = ( ${length} ) - workgroup_id.x * ${u32( workgroupSize * grainSize )};
    ` : ``}

    ${log( {
      name: 'reduced_length',
      dataLength: 1,
      writeU32s: ( arr, offset ) => `${arr}[ ${offset} ] = reduced_length;`,
      deserialize: arr => arr[ 0 ],
    } )}

    for ( var srs_i = 0u; srs_i < ${u32( bitQuantity )}; srs_i += ${u32( innerBitQuantity )} ) {
      ${n_bit_compact_single_sort( {
        valueType: valueType,
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        bitQuantity: innerBitQuantity,
        bitVectorSize: innerBitVectorSize,
        bitsScratch: `bits_scratch`,
        valueScratch: `value_scratch`,
        length: length ? `reduced_length` : null,
        getBits: value => `( ( ( ${getBits( value )} ) >> srs_i ) & ${u32( ( 1 << innerBitQuantity ) - 1 )} )`,
        earlyLoad: earlyLoad,
      } )}

      ${log( {
        name: `after b_bit_sort ${innerBitQuantity} ${innerBitVectorSize}`,
        dataLength: grainSize,
        writeU32s: ( arr, offset ) => `
          workgroupBarrier();
          ${unroll( 0, grainSize, i => `
            ${arr}[ ${offset} + ${u32( i )} ] = value_scratch[ ${u32( grainSize )} * local_id.x + ${u32( i )} ];
          `)}
        `,
        deserialize: arr => [ ...arr ],
        additionalIndex: `srs_i`,
      } )}
    }

    // TODO: we can restructure this so we're not doing all of the reads/bits each time
    ${comment( 'begin write start_indices' )}
    ${unroll( 0, grainSize, i => `
      {
        let local_index = ${u32( workgroupSize * i )} + local_id.x;
        ${conditional_if( length ? `local_index < reduced_length` : null, `
          var head_value = 0u;

          if ( local_index > 0u && ${getBits( `value_scratch[ local_index ]` )} != ${getBits( `value_scratch[ local_index - 1u ]` )} ) {
            head_value = local_index;
          }

          start_indices[ local_index ] = head_value;
        ` )}
      }
    `)}
    ${comment( 'end write start_indices' )}

    workgroupBarrier();

    ${scan_raked( {
      scratch: `start_indices`,
      valueType: 'u32',
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      identity: '0u',
      combineExpression: ( a, b ) => `max( ${a}, ${b} )`,
      exclusive: false,
    } )}

    workgroupBarrier();

    ${comment( 'begin write output' )}
    ${unroll( 0, grainSize, i => `
      {
        let local_index = ${u32( workgroupSize * i )} + local_id.x;
        ${conditional_if( length ? `local_index < reduced_length` : null, `
          let local_offset = local_index - start_indices[ local_index ];
          let value = value_scratch[ local_index ];
          let offset = local_histogram_offsets[ ${getBits( `value` )} ] + local_offset;

          output[ offset ] = value;
        ` )}
      }
    `)}
    ${comment( 'end write output' )}

    ${log( {
      name: 'exit data',
      dataLength: grainSize,
      writeU32s: ( arr, offset ) => `
        storageBarrier();
        ${unroll( 0, grainSize, i => `
          ${arr}[ ${offset} + ${u32( i )} ] = output[ ${u32( workgroupSize * grainSize )} * workgroup_id.x + ${u32( grainSize )} * local_id.x + ${u32( i )} ];
        `)}
      `,
      deserialize: arr => [ ...arr ],
    } )}
  }
}
