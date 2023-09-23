// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL snippet tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BoundsClipping, DualSnippet, DualSnippetSource, LinearEdge, LineClipping, RenderColor, wgsl_add_i64_i64, wgsl_add_u64_u64, wgsl_bounds_clip_edge, wgsl_cmp_i64_i64, wgsl_cmp_u64_u64, wgsl_div_u64_u64, wgsl_gamut_map_linear_displayP3, wgsl_gamut_map_linear_sRGB, wgsl_gamut_map_premul_displayP3, wgsl_gamut_map_premul_sRGB, wgsl_gcd_u64_u64, wgsl_i32_to_i64, wgsl_intersect_line_segments, wgsl_is_negative_i64, wgsl_left_shift_u64, wgsl_linear_displayP3_to_linear_sRGB, wgsl_linear_sRGB_to_linear_displayP3, wgsl_linear_sRGB_to_oklab, wgsl_linear_sRGB_to_sRGB, wgsl_matthes_drakopoulos_clip, wgsl_mul_i64_i64, wgsl_mul_u32_u32_to_u64, wgsl_mul_u64_u64, wgsl_negate_i64, wgsl_oklab_to_linear_sRGB, wgsl_premultiply, wgsl_reduce_q128, wgsl_right_shift_u64, wgsl_sRGB_to_linear_sRGB, wgsl_subtract_i64_i64, wgsl_unpremultiply } from '../imports.js';
import Vector3 from '../../../dot/js/Vector3.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Vector2 from '../../../dot/js/Vector2.js';

QUnit.module( 'Snippet' );

QUnit.test( 'wgsl_mul_u32_u32_to_u64 exists', assert => {
  assert.ok( wgsl_mul_u32_u32_to_u64 );
} );

QUnit.test( 'intersect_line_segments snippet', assert => {
  const snippet = DualSnippet.fromSource( wgsl_intersect_line_segments );
  assert.ok( snippet );
} );

const padLeft = ( input: string, padding: string, length: number ) => {
  let result = input;

  const padLength = length - input.length;
  for ( let i = 0; i < padLength; i++ ) {
    result = padding + result;
  }

  return result;
};

const toU32Hex = ( n: number ) => {
  return padLeft( n.toString( 16 ), '0', 8 );
};
const toU32Binary = ( n: number ) => {
  return padLeft( n.toString( 2 ), '0', 32 );
};

// const n16 = ( 2n ** 16n );
const n32 = ( 2n ** 32n );
// const n64 = ( 2n ** 64n );
// const n16Mask = n16 - 1n;
const n32Mask = n32 - 1n;
// const n64Mask = n64 - 1n;

const nToU32s = ( n: bigint ) => {
  return [ Number( n & n32Mask ), Number( ( n >> 32n ) & n32Mask ) ];
};

// const logInputOutput = ( inputArrayBuffer: ArrayBuffer, outputArrayBuffer: ArrayBuffer ) => {
//   const inputInt32Array = new Int32Array( inputArrayBuffer );
//   const inputUint32Array = new Uint32Array( inputArrayBuffer );
//   const outputUInt32Array = new Uint32Array( outputArrayBuffer );
//   const outputInt32Array = new Int32Array( outputArrayBuffer );
//
//   console.log( 'in (s)', [ ...inputInt32Array ].join( ', ' ) );
//   console.log( 'ou (s)', [ ...outputInt32Array ].join( ', ' ) );
//   console.log( 'in (u)', [ ...inputUint32Array ].join( ', ' ) );
//   console.log( 'ou (u)', [ ...outputUInt32Array ].join( ', ' ) );
//   console.log( 'in', [ ...inputUint32Array ].map( toU32Hex ).join( ', ' ) );
//   console.log( 'ou', [ ...outputUInt32Array ].map( toU32Hex ).join( ', ' ) );
//   console.log( 'in', [ ...inputUint32Array ].map( toU32Binary ).join( ', ' ) );
//   console.log( 'ou', [ ...outputUInt32Array ].map( toU32Binary ).join( ', ' ) );
// };

const runInOut = async (
  device: GPUDevice,
  mainCode: string,
  dependencies: DualSnippet[],
  dispatchSize: number,
  inputArrayBuffer: ArrayBuffer,
  outputArrayBuffer: ArrayBuffer
) => {
  const code = new DualSnippet( `
@group(0) @binding(0) var<storage, read_write> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
`, `
@compute @workgroup_size(1) fn main(
  @builtin(global_invocation_id) id: vec3<u32>
) {
  let i = id.x;
  ${mainCode}
}
`, dependencies ).toString();
  // console.log( code );
  const module = device.createShaderModule( {
    label: 'shader module',
    code: code
  } );

  const bindGroupLayout = device.createBindGroupLayout( {
    entries: [ {
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'storage'
      }
    }, {
      binding: 1,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'storage'
      }
    } ]
  } );

  const pipeline = device.createComputePipeline( {
    label: 'compute pipeline',
    layout: device.createPipelineLayout( {
      bindGroupLayouts: [ bindGroupLayout ]
    } ),
    compute: {
      module: module,
      entryPoint: 'main'
    }
  } );

  const inputSize = inputArrayBuffer.byteLength;
  const outputSize = outputArrayBuffer.byteLength;

  const inputBuffer = device.createBuffer( {
    label: 'work buffer',
    size: inputSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  } );
  device.queue.writeBuffer( inputBuffer, 0, inputArrayBuffer );

  const outputBuffer = device.createBuffer( {
    label: 'output buffer',
    size: outputSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  } );

  const resultBuffer = device.createBuffer( {
    label: 'result buffer',
    size: outputSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  } );

  const bindGroup = device.createBindGroup( {
    label: 'bindGroup',
    layout: pipeline.getBindGroupLayout( 0 ),
    entries: [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } }
    ]
  } );

  const encoder = device.createCommandEncoder( {
    label: 'encoder'
  } );
  const pass = encoder.beginComputePass( {
    label: 'compute pass'
  } );
  pass.setPipeline( pipeline );
  pass.setBindGroup( 0, bindGroup );
  pass.dispatchWorkgroups( dispatchSize );
  pass.end();

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  await resultBuffer.mapAsync( GPUMapMode.READ );
  const resultArrayBuffer = resultBuffer.getMappedRange();
  new Uint8Array( outputArrayBuffer ).set( new Uint8Array( resultArrayBuffer ) );

  resultBuffer.unmap();

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();
};

// const printInOut = async ( device, mainCode, dependencies, dispatchSize, inputArrayBuffer, outputArrayBuffer ) => {
//   await runInOut( device, mainCode, dependencies, dispatchSize, inputArrayBuffer, outputArrayBuffer );
//
//   logInputOutput( inputArrayBuffer, outputArrayBuffer );
// };

const expectInOut = async (
  device: GPUDevice,
  mainCode: string,
  dependencies: DualSnippet[],
  dispatchSize: number,
  inputArrayBuffer: ArrayBuffer,
  expectedOutputArrayBuffer: ArrayBuffer,
  message: string
) => {
  const actualOutputArrayBuffer = new ArrayBuffer( expectedOutputArrayBuffer.byteLength );

  await runInOut( device, mainCode, dependencies, dispatchSize, inputArrayBuffer, actualOutputArrayBuffer );

  const inputUint32Array = new Uint32Array( inputArrayBuffer );
  const expectedOutputUInt32Array = new Uint32Array( expectedOutputArrayBuffer );
  const actualOutputUInt32Array = new Uint32Array( actualOutputArrayBuffer );

  if ( [ ...expectedOutputUInt32Array ].every( ( v, i ) => v === actualOutputUInt32Array[ i ] ) ) {
    console.log( `[PASS] ${message}` );
    return true;
  }
  else {
    console.log( `[FAIL] ${message}` );
    console.log( 'in', [ ...inputUint32Array ].map( toU32Hex ).join( ', ' ) );
    console.log( 'in', [ ...inputUint32Array ].map( toU32Binary ).join( ', ' ) );
    console.log( 'ex', [ ...expectedOutputUInt32Array ].map( toU32Hex ).join( ', ' ) );
    console.log( 'ex', [ ...expectedOutputUInt32Array ].map( toU32Binary ).join( ', ' ) );
    console.log( 'ac', [ ...actualOutputUInt32Array ].map( toU32Hex ).join( ', ' ) );
    console.log( 'ac', [ ...actualOutputUInt32Array ].map( toU32Binary ).join( ', ' ) );
    return false;
  }
};

const devicePromise: Promise<GPUDevice | null> = ( async () => {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    return ( await adapter?.requestDevice() ) || null;
  }
  catch( e ) {
    return null;
  }
} )();

const asyncTestWithDevice = ( name: string, test: ( device: GPUDevice ) => Promise<string | null> ) => {
  QUnit.test( name, async assert => {
    const done = assert.async();

    const device = await devicePromise;

    if ( !device ) {
      assert.expect( 0 );
    }
    else {
      const result = await test( device );
      assert.ok( result === null, result || '' );
    }

    done();
  } );
};

const expectInOutTest = (
  name: string,
  mainCode: string,
  sources: DualSnippetSource[],
  dispatchSize: number,
  inputArrayBuffer: ArrayBuffer,
  expectedOutputArrayBuffer: ArrayBuffer,
  skip = false
) => {
  ( skip ? QUnit.skip : QUnit.test )( name, async assert => {
    const done = assert.async();

    const device = await devicePromise;

    if ( !device ) {
      assert.expect( 0 );
    }
    else {
      assert.ok( await expectInOut(
        device,
        mainCode,
        sources.map( source => DualSnippet.fromSource( source ) ),
        dispatchSize,
        inputArrayBuffer,
        expectedOutputArrayBuffer,
        name
      ), name );
    }

    done();
  } );
};

expectInOutTest(
  'i32_to_i64',
  `
    let in = i * 1u;
    let out = i * 2u;
    let a = bitcast<i32>( input[ in ] );
    let c = i32_to_i64( a );
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
  `,
  [ wgsl_i32_to_i64 ],
  4,
  new Int32Array( [
    0, 25, -7, -1024
  ] ).buffer,
  new Uint32Array( [
    ...nToU32s( 0n ),
    ...nToU32s( 25n ),
    ...nToU32s( -7n ),
    ...nToU32s( -1024n )
  ] ).buffer
);

expectInOutTest(
  'negate_i64',
  `
    let in = i * 2u;
    let out = i * 2u;
    let a = vec2( input[ in + 0u ], input[ in + 1u ] );
    let c = negate_i64( a );
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
  `,
  [ wgsl_negate_i64 ],
  4,
  new Uint32Array( [
    ...nToU32s( 0n ),
    ...nToU32s( 25n ),
    ...nToU32s( -7n ),
    ...nToU32s( -1024n )
  ] ).buffer,
  new Uint32Array( [
    ...nToU32s( -0n ),
    ...nToU32s( -25n ),
    ...nToU32s( 7n ),
    ...nToU32s( 1024n )
  ] ).buffer
);

expectInOutTest(
  'left_shift_u64',
  `
    let out = i * 2u;
    let a = vec2( input[ 0u ], input[ 1u ] );
    let c = left_shift_u64( a, i );
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
  `,
  [ wgsl_left_shift_u64 ],
  64,
  new Uint32Array( [
    ...nToU32s( 0xf9fe432c7aca8bfan )
  ] ).buffer,
  new Uint32Array( [
    // TODO: simplify, I'm lazy
    ...nToU32s( 0xf9fe432c7aca8bfan << 0n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 1n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 2n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 3n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 4n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 5n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 6n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 7n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 8n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 9n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 10n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 11n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 12n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 13n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 14n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 15n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 16n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 17n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 18n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 19n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 20n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 21n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 22n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 23n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 24n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 25n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 26n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 27n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 28n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 29n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 30n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 31n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 32n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 33n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 34n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 35n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 36n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 37n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 38n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 39n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 40n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 41n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 42n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 43n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 44n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 45n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 46n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 47n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 48n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 49n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 50n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 51n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 52n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 53n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 54n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 55n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 56n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 57n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 58n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 59n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 60n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 61n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 62n ),
    ...nToU32s( 0xf9fe432c7aca8bfan << 63n )
  ] ).buffer
);

expectInOutTest(
  'right_shift_u64',
  `
    let out = i * 2u;
    let a = vec2( input[ 0u ], input[ 1u ] );
    let c = right_shift_u64( a, i );
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
  `,
  [ wgsl_right_shift_u64 ],
  64,
  new Uint32Array( [
    ...nToU32s( 0xf9fe432c7aca8bfan )
  ] ).buffer,
  new Uint32Array( [
    // TODO: simplify, I'm lazy
    ...nToU32s( 0xf9fe432c7aca8bfan >> 0n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 1n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 2n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 3n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 4n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 5n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 6n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 7n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 8n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 9n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 10n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 11n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 12n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 13n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 14n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 15n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 16n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 17n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 18n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 19n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 20n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 21n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 22n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 23n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 24n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 25n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 26n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 27n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 28n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 29n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 30n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 31n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 32n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 33n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 34n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 35n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 36n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 37n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 38n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 39n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 40n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 41n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 42n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 43n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 44n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 45n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 46n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 47n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 48n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 49n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 50n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 51n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 52n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 53n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 54n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 55n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 56n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 57n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 58n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 59n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 60n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 61n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 62n ),
    ...nToU32s( 0xf9fe432c7aca8bfan >> 63n )
  ] ).buffer
);

expectInOutTest(
  'is_negative_i64',
  `
    let in = i * 2u;
    let out = i * 1u;
    let a = vec2( input[ in + 0u ], input[ in + 1u ] );
    let c = is_negative_i64( a );
    output[ out ] = select( 0u, 1u, c );
  `,
  [ wgsl_is_negative_i64 ],
  4,
  new Uint32Array( [
    ...nToU32s( 0n ),
    ...nToU32s( 25n ),
    ...nToU32s( -7n ),
    ...nToU32s( -1024n )
  ] ).buffer,
  new Uint32Array( [
    0,
    0,
    1,
    1
  ] ).buffer
);

expectInOutTest(
  'cmp_u64_u64',
  `
    let in = i * 4u;
    let out = i * 1u;
    let a = vec2( input[ in + 0u ], input[ in + 1u ] );
    let b = vec2( input[ in + 2u ], input[ in + 3u ] );
    let c = cmp_u64_u64( a, b );
    output[ out ] = bitcast<u32>( c );
  `,
  [ wgsl_cmp_u64_u64 ],
  3,
  new Uint32Array( [
    ...nToU32s( 5n ),
    ...nToU32s( 7n ),
    ...nToU32s( 7n ),
    ...nToU32s( 5n ),
    ...nToU32s( 12n ),
    ...nToU32s( 12n )
  ] ).buffer,
  new Int32Array( [
    -1, // 5 < 7
    1, // 7 > 5
    0 // -12 = -12
  ] ).buffer
);

expectInOutTest(
  'cmp_i64_i64',
  `
    let in = i * 4u;
    let out = i * 1u;
    let a = vec2( input[ in + 0u ], input[ in + 1u ] );
    let b = vec2( input[ in + 2u ], input[ in + 3u ] );
    let c = cmp_i64_i64( a, b );
    output[ out ] = bitcast<u32>( c );
  `,
  [ wgsl_cmp_i64_i64 ],
  3,
  new Uint32Array( [
    ...nToU32s( 5n ),
    ...nToU32s( 7n ),
    ...nToU32s( 5n ),
    ...nToU32s( -7n ),
    ...nToU32s( -12n ),
    ...nToU32s( -12n )
  ] ).buffer,
  new Int32Array( [
    -1, // 5 < 7
    1, // 5 > -7
    0 // -12 = -12
  ] ).buffer
);

{
  const an = 0xf9fe432c7aca8bfan;
  const bn = 0x583b15971ad94165n;
  const cn = an + bn;

  const dn = 0xddddddddddddddddn;
  const en = 0xababababababababn;
  const fn = dn + en;

  expectInOutTest(
    `add_u64_u64 ${an.toString( 16 )} ${bn.toString( 16 )} = ${cn.toString( 16 )}`,
    `
      let in = i * 4u;
      let out = i * 2u;
      let a = vec2( input[ in + 0u ], input[ in + 1u ] );
      let b = vec2( input[ in + 2u ], input[ in + 3u ] );
      let c = add_u64_u64( a, b );
      output[ out + 0u ] = c.x;
      output[ out + 1u ] = c.y;
    `,
    [ wgsl_add_u64_u64 ],
    2,
    new Uint32Array( [
      ...nToU32s( an ),
      ...nToU32s( bn ),
      ...nToU32s( dn ),
      ...nToU32s( en )
    ] ).buffer,
    new Uint32Array( [
      ...nToU32s( cn ),
      ...nToU32s( fn )
    ] ).buffer
  );
}

{
  const an = 0xf9fe432c7aca8bfan;
  const bn = 0x583b15971ad94165n;
  const cn = an + bn;

  const dn = 0xddddddddddddddddn;
  const en = 0xababababababababn;
  const fn = dn + en;

  expectInOutTest(
    'add_i64_i64',
    `
      let in = i * 4u;
      let out = i * 2u;
      let a = vec2( input[ in + 0u ], input[ in + 1u ] );
      let b = vec2( input[ in + 2u ], input[ in + 3u ] );
      let c = add_i64_i64( a, b );
      output[ out + 0u ] = c.x;
      output[ out + 1u ] = c.y;
    `,
    [ wgsl_add_i64_i64 ],
    2,
    new Uint32Array( [
      ...nToU32s( an ),
      ...nToU32s( bn ),
      ...nToU32s( dn ),
      ...nToU32s( en )
    ] ).buffer,
    new Uint32Array( [
      ...nToU32s( cn ),
      ...nToU32s( fn )
    ] ).buffer
  );
}

{
  const an = 0xf9fe432c7aca8bfan;
  const bn = 0x583b15971ad94165n;
  const cn = an - bn;

  const dn = 0xddddddddddddddddn;
  const en = 0xababababababababn;
  const fn = dn - en;

  expectInOutTest(
    'subtract_i64_i64',
    `
      let in = i * 4u;
      let out = i * 2u;
      let a = vec2( input[ in + 0u ], input[ in + 1u ] );
      let b = vec2( input[ in + 2u ], input[ in + 3u ] );
      let c = subtract_i64_i64( a, b );
      output[ out + 0u ] = c.x;
      output[ out + 1u ] = c.y;
    `,
    [ wgsl_subtract_i64_i64 ],
    2,
    new Uint32Array( [
      ...nToU32s( an ),
      ...nToU32s( bn ),
      ...nToU32s( dn ),
      ...nToU32s( en )
    ] ).buffer,
    new Uint32Array( [
      ...nToU32s( cn ),
      ...nToU32s( fn )
    ] ).buffer
  );
}

expectInOutTest(
  'mul_u64_u64',
  `
    let in = i * 4u;
    let out = i * 2u;
    let a = vec2( input[ in + 0u ], input[ in + 1u ] );
    let b = vec2( input[ in + 2u ], input[ in + 3u ] );
    let c = mul_u64_u64( a, b );
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
  `,
  [ wgsl_mul_u64_u64 ],
  2,
  new Uint32Array( [
    ...nToU32s( 0xf9fe432c7aca8bfan ),
    ...nToU32s( 0x583b15971ad94165n ),
    ...nToU32s( 0x1a951ef9n ),
    ...nToU32s( 0xa629b1b2n )
  ] ).buffer,
  new Uint32Array( [
    ...nToU32s( 0xf9fe432c7aca8bfan * 0x583b15971ad94165n ),
    ...nToU32s( 0x1a951ef9n * 0xa629b1b2n )
  ] ).buffer
);

expectInOutTest(
  'mul_i64_i64',
  `
    let in = i * 4u;
    let out = i * 2u;
    let a = vec2( input[ in + 0u ], input[ in + 1u ] );
    let b = vec2( input[ in + 2u ], input[ in + 3u ] );
    let c = mul_i64_i64( a, b );
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
  `,
  [ wgsl_mul_i64_i64 ],
  5,
  new Uint32Array( [
    ...nToU32s( 0x1a951ef9n ),
    ...nToU32s( 0xa629b1b2n ),
    ...nToU32s( 5n ),
    ...nToU32s( 7n ),
    ...nToU32s( -5n ),
    ...nToU32s( 7n ),
    ...nToU32s( 5n ),
    ...nToU32s( -7n ),
    ...nToU32s( -5n ),
    ...nToU32s( -7n )
  ] ).buffer,
  new Uint32Array( [
    ...nToU32s( 0x1a951ef9n * 0xa629b1b2n ),
    ...nToU32s( 35n ),
    ...nToU32s( -35n ),
    ...nToU32s( -35n ),
    ...nToU32s( 35n )
  ] ).buffer
);

expectInOutTest(
  'div_u64_u64',
  `
    let in = i * 4u;
    let out = i * 4u;
    let a = vec2( input[ in + 0u ], input[ in + 1u ] );
    let b = vec2( input[ in + 2u ], input[ in + 3u ] );
    let c = div_u64_u64( a, b );
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
    output[ out + 2u ] = c.z;
    output[ out + 3u ] = c.w;
  `,
  [ wgsl_div_u64_u64 ],
  3,
  new Uint32Array( [
    ...nToU32s( 32n ),
    ...nToU32s( 5n ),
    ...nToU32s( 0xf9fe432c7aca8bfan ),
    ...nToU32s( 0x583b15971ad94165n ),
    ...nToU32s( 0x19fe432c7aca8bfan ),
    ...nToU32s( 0x1b5dcn )
  ] ).buffer,
  new Uint32Array( [
    ...nToU32s( 6n ),
    ...nToU32s( 2n ),
    ...nToU32s( 0xf9fe432c7aca8bfan / 0x583b15971ad94165n ),
    ...nToU32s( 0xf9fe432c7aca8bfan % 0x583b15971ad94165n ),
    ...nToU32s( 0x19fe432c7aca8bfan / 0x1b5dcn ),
    ...nToU32s( 0x19fe432c7aca8bfan % 0x1b5dcn )
  ] ).buffer
);

{
  const gcd0 = 0xa519bc952f7n;
  const a0 = gcd0 * 0x1542n;
  const b0 = gcd0 * 0xa93n; // chosen as relatively prime

  expectInOutTest(
    'gcd_u64_u64',
    `
      let in = i * 4u;
      let out = i * 2u;
      let a = vec2( input[ in + 0u ], input[ in + 1u ] );
      let b = vec2( input[ in + 2u ], input[ in + 3u ] );
      let c = gcd_u64_u64( a, b );
      output[ out + 0u ] = c.x;
      output[ out + 1u ] = c.y;
    `,
    [ wgsl_gcd_u64_u64 ],
    2,
    new Uint32Array( [
      ...nToU32s( 35n ),
      ...nToU32s( 10n ),
      ...nToU32s( a0 ),
      ...nToU32s( b0 )
    ] ).buffer,
    new Uint32Array( [
      ...nToU32s( 5n ),
      ...nToU32s( gcd0 )
    ] ).buffer
  );
}

expectInOutTest(
  'reduce_q128',
  `
    let in = i * 4u;
    let out = i * 4u;
    let a = vec4( input[ in + 0u ], input[ in + 1u ], input[ in + 2u ], input[ in + 3u ] );
    let c = reduce_q128( a );
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
    output[ out + 2u ] = c.z;
    output[ out + 3u ] = c.w;
  `,
  [ wgsl_reduce_q128 ],
  3,
  new Uint32Array( [
    ...nToU32s( 4n ),
    ...nToU32s( 12n ),
    ...nToU32s( -32n ),
    ...nToU32s( 100n ),
    ...nToU32s( 0n ),
    ...nToU32s( 100n )
  ] ).buffer,
  new Uint32Array( [
    ...nToU32s( 1n ), // 4/12 => 1/3
    ...nToU32s( 3n ),
    ...nToU32s( -8n ), // -32/100 => -8/25
    ...nToU32s( 25n ),
    ...nToU32s( 0n ), // 0/100 => 0/1
    ...nToU32s( 1n )
  ] ).buffer
);

expectInOutTest(
  'intersect_line_segments',
  `
    let in = i * 8u;
    let out = i * 32u;
    let p0 = bitcast<vec2i>( vec2( input[ in + 0u ], input[ in + 1u ] ) );
    let p1 = bitcast<vec2i>( vec2( input[ in + 2u ], input[ in + 3u ] ) );
    let p2 = bitcast<vec2i>( vec2( input[ in + 4u ], input[ in + 5u ] ) );
    let p3 = bitcast<vec2i>( vec2( input[ in + 6u ], input[ in + 7u ] ) );
    let c = intersect_line_segments( p0, p1, p2, p3 );
    output[ out + 0u ] = c.p0.t0.x;
    output[ out + 1u ] = c.p0.t0.y;
    output[ out + 2u ] = c.p0.t0.z;
    output[ out + 3u ] = c.p0.t0.w;
    output[ out + 4u ] = c.p0.t1.x;
    output[ out + 5u ] = c.p0.t1.y;
    output[ out + 6u ] = c.p0.t1.z;
    output[ out + 7u ] = c.p0.t1.w;
    output[ out + 8u ] = c.p0.px.x;
    output[ out + 9u ] = c.p0.px.y;
    output[ out + 10u ] = c.p0.px.z;
    output[ out + 11u ] = c.p0.px.w;
    output[ out + 12u ] = c.p0.py.x;
    output[ out + 13u ] = c.p0.py.y;
    output[ out + 14u ] = c.p0.py.z;
    output[ out + 15u ] = c.p0.py.w;
    output[ out + 16u ] = c.p1.t0.x;
    output[ out + 17u ] = c.p1.t0.y;
    output[ out + 18u ] = c.p1.t0.z;
    output[ out + 19u ] = c.p1.t0.w;
    output[ out + 20u ] = c.p1.t1.x;
    output[ out + 21u ] = c.p1.t1.y;
    output[ out + 22u ] = c.p1.t1.z;
    output[ out + 23u ] = c.p1.t1.w;
    output[ out + 24u ] = c.p1.px.x;
    output[ out + 25u ] = c.p1.px.y;
    output[ out + 26u ] = c.p1.px.z;
    output[ out + 27u ] = c.p1.px.w;
    output[ out + 28u ] = c.p1.py.x;
    output[ out + 29u ] = c.p1.py.y;
    output[ out + 30u ] = c.p1.py.z;
    output[ out + 31u ] = c.p1.py.w;
  `,
  [ wgsl_intersect_line_segments ],
  7,
  new Int32Array( [
    // an X (diagonal)
    0, 0, 100, 100, 0, 100, 100, 0,

    // overlap (skewed)
    // --------
    //     --------
    0, 0, 100, 200, 50, 100, 150, 300,

    // overlap (skewed)
    //     --------
    // --------
    50, 100, 150, 300, 0, 0, 100, 200,

    // overlap (and horizontal)
    //   ----
    // --------
    25, 0, 75, 0, 0, 0, 100, 0,

    // overlap (and vertical)
    // |
    // | |
    // | |
    // |
    0, 0, 0, 15, 0, 5, 0, 10,

    // no intersection
    0, 0, 40, 50, 0, 100, 100, 0,

    // T intersection
    0, 0, 12, 8, 3, 2, 5, -2
  ] ).buffer,
  new Uint32Array( [
    // p0 t0
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p0 t1
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p0 px
    ...nToU32s( 50n ), ...nToU32s( 1n ), // 50
    // p0 py
    ...nToU32s( 50n ), ...nToU32s( 1n ), // 50
    // p1 t0
    0, 0, 0, 0,
    // p1 t1
    0, 0, 0, 0,
    // p1 px
    0, 0, 0, 0,
    // p1 py
    0, 0, 0, 0,

    // p0 t0
    ...nToU32s( 1n ), ...nToU32s( 1n ), // 1
    // p0 t1
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p0 px
    ...nToU32s( 100n ), ...nToU32s( 1n ), // 100
    // p0 py
    ...nToU32s( 200n ), ...nToU32s( 1n ), // 200
    // p1 t0
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p1 t1
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p1 px
    ...nToU32s( 50n ), ...nToU32s( 1n ), // 50
    // p1 py
    ...nToU32s( 100n ), ...nToU32s( 1n ), // 100

    // p0 t0
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 t1
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p0 px
    ...nToU32s( 50n ), ...nToU32s( 1n ), // 50
    // p0 py
    ...nToU32s( 100n ), ...nToU32s( 1n ), // 100
    // p1 t0
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p1 t1
    ...nToU32s( 1n ), ...nToU32s( 1n ), // 1
    // p1 px
    ...nToU32s( 100n ), ...nToU32s( 1n ), // 100
    // p1 py
    ...nToU32s( 200n ), ...nToU32s( 1n ), // 200

    // p0 t0
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 t1
    ...nToU32s( 1n ), ...nToU32s( 4n ), // 1/4
    // p0 px
    ...nToU32s( 25n ), ...nToU32s( 1n ), // 25
    // p0 py
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p1 t0
    ...nToU32s( 1n ), ...nToU32s( 1n ), // 1
    // p1 t1
    ...nToU32s( 3n ), ...nToU32s( 4n ), // 3/4
    // p1 px
    ...nToU32s( 75n ), ...nToU32s( 1n ), // 75
    // p1 py
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0

    // p0 t0
    ...nToU32s( 1n ), ...nToU32s( 3n ), // 1/3
    // p0 t1
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 px
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 py
    ...nToU32s( 5n ), ...nToU32s( 1n ), // 5
    // p1 t0
    ...nToU32s( 2n ), ...nToU32s( 3n ), // 2/3
    // p1 t1
    ...nToU32s( 1n ), ...nToU32s( 1n ), // 1
    // p1 px
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p1 py
    ...nToU32s( 10n ), ...nToU32s( 1n ), // 10

    // p0 t0
    0, 0, 0, 0,
    // p0 t1
    0, 0, 0, 0,
    // p0 px
    0, 0, 0, 0,
    // p0 py
    0, 0, 0, 0,
    // p1 t0
    0, 0, 0, 0,
    // p1 t1
    0, 0, 0, 0,
    // p1 px
    0, 0, 0, 0,
    // p1 py
    0, 0, 0, 0,

    // p0 t0
    ...nToU32s( 1n ), ...nToU32s( 4n ), // 1/4
    // p0 t1
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 px
    ...nToU32s( 3n ), ...nToU32s( 1n ), // 3
    // p0 py
    ...nToU32s( 2n ), ...nToU32s( 1n ), // 2
    // p1 t0
    0, 0, 0, 0,
    // p1 t1
    0, 0, 0, 0,
    // p1 px
    0, 0, 0, 0,
    // p1 py
    0, 0, 0, 0
  ] ).buffer
);

const vec3Test = ( name: string, source: DualSnippetSource, f: ( v: Vector3 ) => Vector3, inputVectors: Vector3[] ) => {
  asyncTestWithDevice( name, async device => {
    const dispatchSize = inputVectors.length;

    const outputArray = new Float32Array( dispatchSize * 3 );

    await runInOut(
      device,
      `
        let in = i * 3u;
        let out = i * 3u;
        let a = bitcast<vec3<f32>>( vec3( input[ in + 0u ], input[ in + 1u ], input[ in + 2u ] ) );
        let c = bitcast<vec3<u32>>( ${name}( a ) );
        output[ out + 0u ] = c.x;
        output[ out + 1u ] = c.y;
        output[ out + 2u ] = c.z;
      `,
      [ DualSnippet.fromSource( source ) ],
      dispatchSize,
      new Float32Array( inputVectors.flatMap( v => [ v.x, v.y, v.z ] ) ).buffer,
      outputArray.buffer
    );

    const actualVectors = [];
    for ( let i = 0; i < dispatchSize; i++ ) {
      actualVectors.push( new Vector3( outputArray[ i * 3 ], outputArray[ i * 3 + 1 ], outputArray[ i * 3 + 2 ] ) );
    }

    const expectedVectors = inputVectors.map( f );

    for ( let i = 0; i < dispatchSize; i++ ) {
      const actual = actualVectors[ i ];
      const expected = expectedVectors[ i ];

      if ( !expected.equalsEpsilon( actual, 1e-4 ) ) {
        return `${name} failure expected: ${expected}, actual: ${actual}, i:${i}`;
      }
    }

    return null;
  } );
};

const vec4Test = ( name: string, source: DualSnippetSource, f: ( v: Vector4 ) => Vector4, inputVectors: Vector4[] ) => {
  asyncTestWithDevice( name, async device => {
    const dispatchSize = inputVectors.length;

    const outputArray = new Float32Array( dispatchSize * 4 );

    await runInOut(
      device,
      `
        let in = i * 4u;
        let out = i * 4u;
        let a = bitcast<vec4<f32>>( vec4( input[ in + 0u ], input[ in + 1u ], input[ in + 2u ], input[ in + 3u ] ) );
        let c = bitcast<vec4<u32>>( ${name}( a ) );
        output[ out + 0u ] = c.x;
        output[ out + 1u ] = c.y;
        output[ out + 2u ] = c.z;
        output[ out + 3u ] = c.w;
      `,
      [ DualSnippet.fromSource( source ) ],
      dispatchSize,
      new Float32Array( inputVectors.flatMap( v => [ v.x, v.y, v.z, v.w ] ) ).buffer,
      outputArray.buffer
    );

    const actualVectors = [];
    for ( let i = 0; i < dispatchSize; i++ ) {
      actualVectors.push( new Vector4( outputArray[ i * 4 ], outputArray[ i * 4 + 1 ], outputArray[ i * 4 + 2 ], outputArray[ i * 4 + 3 ] ) );
    }

    const expectedVectors = inputVectors.map( f );

    for ( let i = 0; i < dispatchSize; i++ ) {
      const actual = actualVectors[ i ];
      const expected = expectedVectors[ i ];

      if ( !expected.equalsEpsilon( actual, 1e-5 ) ) {
        return `${name} failure expected: ${expected}, actual: ${actual}, i:${i}`;
      }
    }

    return null;
  } );
};

vec3Test( 'linear_sRGB_to_sRGB', wgsl_linear_sRGB_to_sRGB, ( color: Vector3 ) => {
  return RenderColor.linearToSRGB( color.toVector4() ).toVector3();
}, [
  new Vector3( 0.9, 0.0, 0.0001 ),
  new Vector3( 0.99, 0.5, 0.002 )
] );

vec3Test( 'sRGB_to_linear_sRGB', wgsl_sRGB_to_linear_sRGB, ( color: Vector3 ) => {
  return RenderColor.sRGBToLinear( color.toVector4() ).toVector3();
}, [
  new Vector3( 0.9, 0.0, 0.0001 ),
  new Vector3( 0.99, 0.5, 0.002 )
] );

vec3Test( 'linear_sRGB_to_oklab', wgsl_linear_sRGB_to_oklab, ( color: Vector3 ) => {
  return RenderColor.linearToOklab( color.toVector4() ).toVector3();
}, [
  new Vector3( 0.9, 0.0, 0.0001 ),
  new Vector3( 0.99, 0.5, 0.002 ),
  new Vector3( 0.5, 0.5, 0.5 ),
  new Vector3( -0.2, 0.5, 0.5 ),
  new Vector3( 0.2, -0.5, 0.5 ),
  new Vector3( 0.2, 0.5, -0.5 ),
  new Vector3( 1.5, 20.5, 0.7 ),
  new Vector3( -0.1, -0.2, -0.3 )
] );

vec3Test( 'oklab_to_linear_sRGB', wgsl_oklab_to_linear_sRGB, ( color: Vector3 ) => {
  return RenderColor.oklabToLinear( color.toVector4() ).toVector3();
}, [
  new Vector3( 0.9, 0.0, 0.0001 ),
  new Vector3( 0.99, 0.5, 0.002 ),
  new Vector3( 0.5, 0.5, 0.5 ),
  new Vector3( -0.02, 0.5, 0.5 ),
  new Vector3( 0.2, -0.05, 0.5 ),
  new Vector3( 0.2, 0.5, -0.05 ),
  new Vector3( 1.5, 2.5, 0.7 ),
  new Vector3( -0.01, -0.02, -0.03 )
] );

vec3Test( 'linear_displayP3_to_linear_sRGB', wgsl_linear_displayP3_to_linear_sRGB, ( color: Vector3 ) => {
  return RenderColor.linearDisplayP3ToLinear( color.toVector4() ).toVector3();
}, [
  new Vector3( 0.9, 0.0, 0.0001 ),
  new Vector3( 0.99, 0.5, 0.002 ),
  new Vector3( 0.5, 0.5, 0.5 )
] );

vec3Test( 'linear_sRGB_to_linear_displayP3', wgsl_linear_sRGB_to_linear_displayP3, ( color: Vector3 ) => {
  return RenderColor.linearToLinearDisplayP3( color.toVector4() ).toVector3();
}, [
  new Vector3( 0.9, 0.0, 0.0001 ),
  new Vector3( 0.99, 0.5, 0.002 ),
  new Vector3( 0.5, 0.5, 0.5 )
] );

vec3Test( 'gamut_map_linear_sRGB', wgsl_gamut_map_linear_sRGB, ( color: Vector3 ) => {
  return RenderColor.gamutMapLinearSRGB( color.toVector4() ).toVector3();
}, [
  new Vector3( 0.2, 0.5, 0.7 ),
  new Vector3( 0, 0, 0 ),
  new Vector3( 1, 1, 1 ),
  new Vector3( -0.2, 0.5, 0.5 ),
  new Vector3( 0.2, -0.5, 0.5 ),
  new Vector3( 0.2, 0.5, -0.5 ),
  new Vector3( 1.5, 20.5, 0.7 ),
  new Vector3( -0.1, -0.2, -0.3 )
] );

vec3Test( 'gamut_map_linear_displayP3', wgsl_gamut_map_linear_displayP3, ( color: Vector3 ) => {
  return RenderColor.gamutMapLinearDisplayP3( color.toVector4() ).toVector3();
}, [
  new Vector3( 0.2, 0.5, 0.7 ),
  new Vector3( 0, 0, 0 ),
  new Vector3( 1, 1, 1 ),
  new Vector3( -0.2, 0.5, 0.5 ),
  new Vector3( 0.2, -0.5, 0.5 ),
  new Vector3( 0.2, 0.5, -0.5 ),
  new Vector3( 1.5, 20.5, 0.7 ),
  new Vector3( -0.1, -0.2, -0.3 )
] );

vec4Test( 'gamut_map_premul_sRGB', wgsl_gamut_map_premul_sRGB, RenderColor.gamutMapPremultipliedSRGB, [
  new Vector4( 0.2, 0.5, 0.7, 1 ),
  new Vector4( 0, 0, 0, 0.2 ),
  new Vector4( 0.5, 0.5, 0.5, 0.5 ),
  new Vector4( -0.2, 0.5, 0.5, 1 ),
  new Vector4( 0.2, -0.5, 0.5, 1 ),
  new Vector4( 0.2, 0.5, -0.05, 0.5 ),
  new Vector4( 1.5, 3.5, 0.7, 1 ),
  new Vector4( -0.1, -0.2, -0.3, 1 )
] );

vec4Test( 'gamut_map_premul_displayP3', wgsl_gamut_map_premul_displayP3, RenderColor.gamutMapPremultipliedDisplayP3, [
  new Vector4( 0.2, 0.5, 0.7, 1 ),
  new Vector4( 0, 0, 0, 0.2 ),
  new Vector4( 0.5, 0.5, 0.5, 0.5 ),
  new Vector4( -0.2, 0.5, 0.5, 1 ),
  new Vector4( 0.2, -0.5, 0.5, 1 ),
  new Vector4( 0.2, 0.5, -0.05, 0.5 ),
  new Vector4( 1.5, 3.5, 0.7, 1 ),
  new Vector4( -0.1, -0.2, -0.3, 1 )
] );

vec4Test( 'premultiply', wgsl_premultiply, RenderColor.premultiply, [
  new Vector4( 1, 0.5, 0, 0 ),
  new Vector4( 1, 0.5, 0, 0.25 ),
  new Vector4( 1, 0.5, 0, 1 )
] );

vec4Test( 'unpremultiply', wgsl_unpremultiply, RenderColor.unpremultiply, [
  new Vector4( 0, 0, 0, 0 ),
  new Vector4( 0.25, 0.125, 0, 0.25 ),
  new Vector4( 1, 0.5, 0, 1 )
] );

const exampleEdges = [
  [ new Vector2( -5, 5 ), new Vector2( 5, 5 ) ],
  [ new Vector2( -5, 5 ), new Vector2( 5, 7 ) ],
  [ new Vector2( 2, 5 ), new Vector2( 5, 7 ) ],
  [ new Vector2( -5, -1 ), new Vector2( 15, 11 ) ],
  [ new Vector2( -50, -1 ), new Vector2( 15, 50 ) ],
  [ new Vector2( 0, 0 ), new Vector2( 10, 10 ) ],
  [ new Vector2( -1, -1 ), new Vector2( 10, 10 ) ],
  [ new Vector2( 5, 0 ), new Vector2( 5, 10 ) ],
  [ new Vector2( 5, 0 ), new Vector2( 10, 5 ) ],
  [ new Vector2( 2.6147993696171348, -0.553789156287392 ), new Vector2( 7.301251859632316, 11.12556982072092 ) ],
  [ new Vector2( 18.89810139537426, 2.2094768322214158 ), new Vector2( -8.145414942629914, -7.943351998427259 ) ],
  [ new Vector2( -5.114212446865764, 0.23568666630103863 ), new Vector2( 14.46979169942307, -0.7629020706808571 ) ],
  [ new Vector2( -0.6916446036007571, 7.050987112851427 ), new Vector2( 17.53843380230145, 8.17194775357202 ) ],
  [ new Vector2( -3.6587812385968865, -7.779053151699873 ), new Vector2( 7.306015667416595, 9.34821537139516 ) ],
  [ new Vector2( 11.952423647412605, -8.31001855243305 ), new Vector2( 0.3765902347513901, 15.4748221419894 ) ],
  [ new Vector2( -1.6528232931632232, 1.207688180506386 ), new Vector2( 0.9880635890461438, -9.1054295688964 ) ],
  [ new Vector2( 4.186522263582177, 0.8387677765118262 ), new Vector2( 18.713676265395172, -9.205548692287334 ) ],
  [ new Vector2( -7.33026899807808, -7.841694321535777 ), new Vector2( 14.04560966751405, 0.0012476650727872851 ) ],
  [ new Vector2( 4.6382447216596905, 19.604230521006873 ), new Vector2( 16.356531539250618, 11.758060388215938 ) ],
  [ new Vector2( 2.4359626793050015, 13.6742500079345 ), new Vector2( -7.009960204426074, 10.041950240306598 ) ],
  [ new Vector2( 15.829892516167558, -7.365872695752087 ), new Vector2( 13.641369394163632, -2.740998684227489 ) ],
  [ new Vector2( 15.84082422042351, 19.46531451460824 ), new Vector2( 2.648905385406092, 3.524330461954829 ) ],
  [ new Vector2( -6.58929578566535, 7.513226200859506 ), new Vector2( 1.4157029754254786, 19.546517248684722 ) ],
  [ new Vector2( 12.29136397280849, 3.7099869767194544 ), new Vector2( 14.407405548252012, -6.691097991707313 ) ],
  [ new Vector2( 6.653564903890764, 8.541871478293718 ), new Vector2( 10.316655898684207, 9.716033721567452 ) ],
  [ new Vector2( 19.107593256198744, 13.883975533445017 ), new Vector2( 7.03360666009965, -6.181065523800859 ) ],
  [ new Vector2( -2.2881343214393617, -5.088902888528278 ), new Vector2( 0.8596999834453101, 6.90516195740944 ) ],
  [ new Vector2( -9.510715779274852, 3.072360696412117 ), new Vector2( 18.76479847583736, -6.01709939051198 ) ],
  [ new Vector2( 4.666621671280492, 12.50557403324764 ), new Vector2( 18.89186249527278, -7.462926612278573 ) ],
  [ new Vector2( 1.0127273038617552, -1.8273089376626732 ), new Vector2( 12.841569855993, 1.2601670146533124 ) ],
  [ new Vector2( -2.169094530187115, 3.2724976287211067 ), new Vector2( 17.661985898546753, 13.205965840504742 ) ],
  [ new Vector2( 14.367367856646197, 13.48480971840549 ), new Vector2( 4.802365813100227, 6.216801055710171 ) ],
  [ new Vector2( 0.6398499613550062, 14.172922805001637 ), new Vector2( -8.537407168689812, -6.613207326401993 ) ],
  [ new Vector2( 19.12489500016116, 13.79022545306147 ), new Vector2( -7.350255924902842, -4.15700105586474 ) ],
  [ new Vector2( 16.399155045230817, 12.705800775587477 ), new Vector2( 13.497037552644578, 2.391792698645565 ) ],
  [ new Vector2( 5.425237900757441, -1.2863375208584156 ), new Vector2( 2.698677708218744, -6.829038005767655 ) ],
  [ new Vector2( -4.3202604845971715, 19.615603123138833 ), new Vector2( 3.2279493871821785, -4.385973312552887 ) ],
  [ new Vector2( -3.4872481514527376, -1.9101058302482503 ), new Vector2( 3.4285902984073537, 16.875050628458464 ) ],
  [ new Vector2( 18.716428467847816, -2.523148587284007 ), new Vector2( 15.451081077205618, -5.224449138988101 ) ],
  [ new Vector2( 10.511343612952537, -9.463295294051496 ), new Vector2( 10.742154704447312, -5.240336201412248 ) ],
  [ new Vector2( 3.8650784389794435, -6.080983284844019 ), new Vector2( 19.573631298112538, 9.88749428556671 ) ],
  [ new Vector2( 7.898687608473473, -7.602812720213679 ), new Vector2( -9.700227180380667, -3.6966581195313193 ) ],
  [ new Vector2( 2.6205636135853787, -6.930049895950963 ), new Vector2( 18.94584724454645, 8.874498478661021 ) ],
  [ new Vector2( 17.59952571535516, 16.527657483235412 ), new Vector2( -1.3374617669055482, 18.617991351150344 ) ],
  [ new Vector2( -0.29076480744609867, 3.0515961212852503 ), new Vector2( 18.316569796146005, 8.366190226739423 ) ],
  [ new Vector2( 19.023824706979582, -6.455895455943958 ), new Vector2( 3.4764681115869944, -4.2724060062483264 ) ],
  [ new Vector2( 15.725308418309336, 16.760721419599363 ), new Vector2( 19.265524536344167, 8.862462301052602 ) ],
  [ new Vector2( -6.110784516307206, 5.619189802819607 ), new Vector2( 19.852054195006513, 7.2202142843778425 ) ],
  [ new Vector2( -3.7899410255629506, 2.424402703139478 ), new Vector2( 18.98030875788033, 11.761649171532746 ) ],
  [ new Vector2( -1.5710507556264712, 17.63355523669644 ), new Vector2( 9.26333558174818, 14.27037776500784 ) ],
  [ new Vector2( 6.98725574965097, -4.934364117266529 ), new Vector2( -5.395631987791393, 5.55526566876685 ) ],
  [ new Vector2( 2.8542142120610396, 18.99456901108667 ), new Vector2( 2.359947985555607, -7.508637150981377 ) ],
  [ new Vector2( -5.760288200006228, 16.176864850255885 ), new Vector2( 14.745270578131905, 8.563609972490138 ) ],
  [ new Vector2( 17.745255103924226, -6.158106368262468 ), new Vector2( -8.967561357104108, 7.201388107722199 ) ],
  [ new Vector2( -8.648962133959166, 18.025198445020315 ), new Vector2( -1.7458857204364175, 15.58360141383502 ) ],
  [ new Vector2( -4.773688232775106, 12.925023586642759 ), new Vector2( 16.572590015990396, 6.948346080741789 ) ],
  [ new Vector2( 8.253272459388018, 0.6522905293562715 ), new Vector2( 5.935891664305501, 15.573121408981876 ) ],
  [ new Vector2( -7.746195881707909, -8.4320172054141 ), new Vector2( -4.218050776319506, 14.035353453520997 ) ],
  [ new Vector2( 1.1525451122586166, 17.5899474886586 ), new Vector2( 9.43613792237845, 18.90271086371388 ) ],
  [ new Vector2( -3.590845831870391, 10.164101440605158 ), new Vector2( 17.302450347094734, 11.405476139782756 ) ],
  [ new Vector2( -2.4790568860386024, -2.7794869184331166 ), new Vector2( 15.036939346530179, 10.186463358895786 ) ],
  [ new Vector2( 17.906963561374486, 9.350371018413604 ), new Vector2( 19.66911451053709, 8.090669248622433 ) ],
  [ new Vector2( -6.321967355007523, -8.920559118822041 ), new Vector2( 19.639246166874585, -5.680682123300247 ) ],
  [ new Vector2( 3.0369116607281725, -4.4561765436071905 ), new Vector2( 15.080705598778234, 2.5988205911922755 ) ],
  [ new Vector2( -7.237586983216424, 3.7034703558072994 ), new Vector2( -5.17887488420532, 13.617167159902817 ) ],
  [ new Vector2( -4.0368634888014725, 19.34469343644363 ), new Vector2( -1.5211528425652059, 1.535994339651479 ) ],
  [ new Vector2( 16.650377939230527, 13.565238528672424 ), new Vector2( -4.264875279487182, 11.57274695965516 ) ],
  [ new Vector2( 14.466171303735894, -0.522753409270516 ), new Vector2( -9.155960578870332, 8.478992426718243 ) ],
  [ new Vector2( 17.995729881475974, 18.54050816163661 ), new Vector2( 6.898852177232257, 18.26402630512435 ) ],
  [ new Vector2( 17.26124836684113, -9.417681282426372 ), new Vector2( 15.336662071226229, 15.484562000239784 ) ],
  [ new Vector2( -1.8388559729254865, -3.5105430935320943 ), new Vector2( -7.1248635700913265, 6.803662635603555 ) ],
  [ new Vector2( 6.062323287847661, 17.835846859788166 ), new Vector2( 13.494363539999409, 1.9394430067574024 ) ],
  [ new Vector2( 13.076844496371244, 7.611860809112535 ), new Vector2( 12.581913127903213, 17.9381813566876 ) ],
  [ new Vector2( 15.17825353976582, 3.8255440063455595 ), new Vector2( 10.339645352510082, 13.440554371422603 ) ],
  [ new Vector2( 3.2257977121876085, 18.022880591133404 ), new Vector2( 7.39054934500032, -4.214953340963136 ) ],
  [ new Vector2( 6.635071608910774, 14.000171800892428 ), new Vector2( -5.1747474436936365, -0.8819496978440515 ) ],
  [ new Vector2( 6.5672680606333635, 5.610739965743159 ), new Vector2( 15.445629897909946, -7.458115979459983 ) ],
  [ new Vector2( -2.509087498859957, 0.2533179121195399 ), new Vector2( 11.933845855177381, -2.6309103138947236 ) ],
  [ new Vector2( 5.586237918424411, 7.271456092178596 ), new Vector2( -0.029520046023403523, 4.8095836130241025 ) ],
  [ new Vector2( 11.49433830926641, 15.013516347043247 ), new Vector2( -1.3677996254067732, 6.119200289348942 ) ],
  [ new Vector2( 5.740254909584639, -4.94039126287551 ), new Vector2( 1.636569996289106, 17.225739809685205 ) ],
  [ new Vector2( -3.143970869211607, -4.423025884581893 ), new Vector2( -3.8610417937402257, 7.8357190421622995 ) ],
  [ new Vector2( 4.992074348184071, -2.4550152233427784 ), new Vector2( -2.3825532400734595, -9.964283688341794 ) ],
  [ new Vector2( 1.8807237434907762, 3.895577468031961 ), new Vector2( 3.7775793073742925, 14.598863687193987 ) ],
  [ new Vector2( 1.9084385303003604, -4.973026683002242 ), new Vector2( 1.577605647352268, -0.2049299180529811 ) ],
  [ new Vector2( -6.243219133714262, -2.166940477209134 ), new Vector2( 8.73299117685578, 12.018802411579074 ) ],
  [ new Vector2( -7.1875815313697355, 14.491906718694242 ), new Vector2( 9.110611883102678, 19.128366271806307 ) ],
  [ new Vector2( -5.242764535121982, 4.834767633629154 ), new Vector2( 6.874216252947363, -6.299040661659648 ) ],
  [ new Vector2( -4.118843195903981, -9.4872218483514 ), new Vector2( 3.621703122481822, -7.569448730759484 ) ],
  [ new Vector2( 14.224466135034103, -4.392691992786137 ), new Vector2( -7.759955118627195, 0.12101322318913432 ) ],
  [ new Vector2( 9.450063268542035, 17.577740302420647 ), new Vector2( -3.4795410413838663, 6.893694282240009 ) ],
  [ new Vector2( -7.455396546588792, 15.431294542967933 ), new Vector2( 12.218373210811674, -0.6875628057532008 ) ],
  [ new Vector2( 18.697061623298875, -9.9526832074174 ), new Vector2( -5.084165817296515, 2.932683040474835 ) ],
  [ new Vector2( 4.873404110684703, -4.083400478543034 ), new Vector2( 4.783389084364572, 5.794204919790822 ) ],
  [ new Vector2( 8.91123062234962, 13.656679146958837 ), new Vector2( 1.4282883503460084, 8.603330425347814 ) ],
  [ new Vector2( 3.563568170896369, 11.510402037227866 ), new Vector2( 19.282170207278256, 18.557617932723637 ) ],
  [ new Vector2( 13.648331514108392, -1.2482722733006426 ), new Vector2( -9.735943659190465, -6.2594294311986935 ) ],
  [ new Vector2( 4.474885699130841, 5.845617847706464 ), new Vector2( 4.5809155824606265, 19.08333187174025 ) ],
  [ new Vector2( 7.8401199983224075, -2.551146603566254 ), new Vector2( -2.0838502962576166, 6.21382461315843 ) ],
  [ new Vector2( -4.579835279091258, 9.7675909387272 ), new Vector2( -2.137977695479023, -8.561939336514776 ) ],
  [ new Vector2( 18.960811092238842, -1.9658693683214175 ), new Vector2( -2.576144156538871, -4.670538883521013 ) ],
  [ new Vector2( -0.4652538407084368, 18.803947706630996 ), new Vector2( 0.9046923220469836, 3.45797604977899 ) ],
  [ new Vector2( 17.917292442322047, 2.2421203451576375 ), new Vector2( -5.235228479416911, -8.026372268316685 ) ],
  [ new Vector2( 2.6097523965538105, 7.032599142988204 ), new Vector2( -0.25671393829534317, 18.684216806737435 ) ],
  [ new Vector2( 18.24077608690835, 13.099379853451946 ), new Vector2( 10.612056022623516, 16.668337119284388 ) ],
  [ new Vector2( 0.5363038220087972, -4.871521344489511 ), new Vector2( 0.7696848986899418, -4.9772512124643775 ) ],
  [ new Vector2( 3.8312042770331374, -4.941019528416861 ), new Vector2( 15.7721252192839, 4.536187231558982 ) ],
  [ new Vector2( -4.5037298137179445, 8.337579275347387 ), new Vector2( -1.6446043483351431, 19.90315845387308 ) ],
  [ new Vector2( -7.52457257131931, 18.40311322951526 ), new Vector2( 17.24681280213877, 9.168327059294235 ) ]
] as const;

const matthesDrakopoulosTest = ( name: string, extractSlope: boolean ) => {
  asyncTestWithDevice( name, async device => {
    const inputEdges = exampleEdges;

    const dispatchSize = inputEdges.length;

    const outputArray = new Float32Array( dispatchSize * 5 );
    const uint32Array = new Uint32Array( outputArray.buffer );

    await runInOut(
      device,
      `
        let in = i * 4u;
        let out = i * 5u;
        let p0 = bitcast<vec2<f32>>( vec2( input[ in + 0u ], input[ in + 1u ] ) );
        let p1 = bitcast<vec2<f32>>( vec2( input[ in + 2u ], input[ in + 3u ] ) );
        let result = matthes_drakopoulos_clip( p0, p1, 0f, 0f, 10f, 10f );
        let p0out = bitcast<vec2<u32>>( result.p0 );
        let p1out = bitcast<vec2<u32>>( result.p1 );
        let clipped = result.clipped;
        output[ out + 0u ] = p0out.x;
        output[ out + 1u ] = p0out.y;
        output[ out + 2u ] = p1out.x;
        output[ out + 3u ] = p1out.y;
        output[ out + 4u ] = select( 0u, 1u, clipped );
      `,
      [ DualSnippet.fromSource( wgsl_matthes_drakopoulos_clip, {
        matthes_drakopoulos_extract_slope: extractSlope
      } ) ],
      dispatchSize,
      new Float32Array( inputEdges.flatMap( entry => [
        entry[ 0 ].x,
        entry[ 0 ].y,
        entry[ 1 ].x,
        entry[ 1 ].y
      ] ) ).buffer,
      outputArray.buffer
    );

    for ( let i = 0; i < dispatchSize; i++ ) {
      const baseIndex = i * 5;

      const p0 = inputEdges[ i ][ 0 ];
      const p1 = inputEdges[ i ][ 1 ];

      const expectedP0 = p0.copy();
      const expectedP1 = p1.copy();
      const expectedClipped = LineClipping.matthesDrakopoulosClip( expectedP0, expectedP1, 0, 0, 10, 10 );

      const actualP0 = new Vector2( outputArray[ baseIndex ], outputArray[ baseIndex + 1 ] );
      const actualP1 = new Vector2( outputArray[ baseIndex + 2 ], outputArray[ baseIndex + 3 ] );
      const actualClipped = uint32Array[ baseIndex + 4 ] !== 0;

      if ( actualClipped !== expectedClipped ) {
        return `matthes_drakopoulos_clip clip discrepancy, expected: ${expectedClipped}, actual: ${actualClipped}, i:${i}`;
      }
      if ( actualClipped ) {
        if ( !expectedP0.equalsEpsilon( actualP0, 1e-5 ) ) {
          return `matthes_drakopoulos_clip p0 discrepancy, expected: ${expectedP0}, actual: ${actualP0}, i:${i}`;
        }
        if ( !expectedP1.equalsEpsilon( actualP1, 1e-5 ) ) {
          return `matthes_drakopoulos_clip p1 discrepancy, expected: ${expectedP1}, actual: ${actualP1}, i:${i}`;
        }
      }
    }

    return null;
  } );
};

matthesDrakopoulosTest( 'matthes_drakopoulos_clip unextracted', false );
matthesDrakopoulosTest( 'matthes_drakopoulos_clip extracted', true );

asyncTestWithDevice( 'bounds_clip_edge', async device => {
  const inputEdges = exampleEdges;

  const dispatchSize = inputEdges.length;

  const outputArray = new Float32Array( dispatchSize * 13 );
  const uint32Array = new Uint32Array( outputArray.buffer );

  await runInOut(
    device,
    `
      let in = i * 4u;
      let out = i * 13u;
      let p0 = bitcast<vec2<f32>>( vec2( input[ in + 0u ], input[ in + 1u ] ) );
      let p1 = bitcast<vec2<f32>>( vec2( input[ in + 2u ], input[ in + 3u ] ) );
      let result = bounds_clip_edge( LinearEdge( p0, p1 ), 0f, 0f, 10f, 10f, 5f, 5f );
      
      let e0p0 = bitcast<vec2<u32>>( result.edges[ 0u ].startPoint );
      let e0p1 = bitcast<vec2<u32>>( result.edges[ 0u ].endPoint );
      
      let e1p0 = bitcast<vec2<u32>>( result.edges[ 1u ].startPoint );
      let e1p1 = bitcast<vec2<u32>>( result.edges[ 1u ].endPoint );
      
      let e2p0 = bitcast<vec2<u32>>( result.edges[ 2u ].startPoint );
      let e2p1 = bitcast<vec2<u32>>( result.edges[ 2u ].endPoint );
      
      let count = u32( result.count );
      
      output[ out + 0u ] = e0p0.x;
      output[ out + 1u ] = e0p0.y;
      output[ out + 2u ] = e0p1.x;
      output[ out + 3u ] = e0p1.y;
      output[ out + 4u ] = e1p0.x;
      output[ out + 5u ] = e1p0.y;
      output[ out + 6u ] = e1p1.x;
      output[ out + 7u ] = e1p1.y;
      output[ out + 8u ] = e2p0.x;
      output[ out + 9u ] = e2p0.y;
      output[ out + 10u ] = e2p1.x;
      output[ out + 11u ] = e2p1.y;
      output[ out + 12u ] = count;
    `,
    [ DualSnippet.fromSource( wgsl_bounds_clip_edge ) ],
    dispatchSize,
    new Float32Array( inputEdges.flatMap( entry => [
      entry[ 0 ].x,
      entry[ 0 ].y,
      entry[ 1 ].x,
      entry[ 1 ].y
    ] ) ).buffer,
    outputArray.buffer
  );

  for ( let i = 0; i < dispatchSize; i++ ) {
    const baseIndex = i * 13;

    const inputEdge = new LinearEdge(
      inputEdges[ i ][ 0 ],
      inputEdges[ i ][ 1 ]
    );

    const actualEdges: LinearEdge[] = [];
    const actualCount = uint32Array[ baseIndex + 12 ];
    for ( let j = 0; j < actualCount; j++ ) {
      const edgeBaseIndex = baseIndex + j * 4;
      const edge = new LinearEdge(
        new Vector2( outputArray[ edgeBaseIndex ], outputArray[ edgeBaseIndex + 1 ] ),
        new Vector2( outputArray[ edgeBaseIndex + 2 ], outputArray[ edgeBaseIndex + 3 ] )
      );
      if ( edge.startPoint.distance( edge.endPoint ) > 1e-7 ) {
        actualEdges.push( edge );
      }
    }

    const expectedEdges: LinearEdge[] = [];
    BoundsClipping.boundsClipEdge( inputEdge.startPoint, inputEdge.endPoint, 0, 0, 10, 10, 5, 5, expectedEdges );

    if ( actualEdges.length !== expectedEdges.length ) {
      return `bounds_clip_edge edge count discrepancy, expected: ${expectedEdges.length}, actual: ${actualEdges.length}, i:${i}`;
    }

    for ( let i = 0; i < actualEdges.length; i++ ) {
      const actualEdge = actualEdges[ i ];
      const expectedEdge = expectedEdges[ i ];

      if ( !expectedEdge.startPoint.equalsEpsilon( actualEdge.startPoint, 1e-5 ) ) {
        return `bounds_clip_edge start point discrepancy, expected: ${expectedEdge.startPoint}, actual: ${actualEdge.startPoint}, i:${i}`;
      }
      if ( !expectedEdge.endPoint.equalsEpsilon( actualEdge.endPoint, 1e-5 ) ) {
        return `bounds_clip_edge end point discrepancy, expected: ${expectedEdge.endPoint}, actual: ${actualEdge.endPoint}, i:${i}`;
      }
    }
  }

  return null;
} );