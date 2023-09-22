// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL snippet tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { DualSnippet, DualSnippetSource, RenderColor, wgsl_add_i64_i64, wgsl_add_u64_u64, wgsl_cmp_i64_i64, wgsl_cmp_u64_u64, wgsl_div_u64_u64, wgsl_gcd_u64_u64, wgsl_i32_to_i64, wgsl_intersect_line_segments, wgsl_is_negative_i64, wgsl_left_shift_u64, wgsl_linear_sRGB_to_oklab, wgsl_linear_sRGB_to_sRGB, wgsl_mul_i64_i64, wgsl_mul_u32_u32_to_u64, wgsl_mul_u64_u64, wgsl_negate_i64, wgsl_oklab_to_linear_sRGB, wgsl_premultiply, wgsl_reduce_q128, wgsl_right_shift_u64, wgsl_sRGB_to_linear_sRGB, wgsl_subtract_i64_i64, wgsl_unpremultiply } from '../imports.js';
import Vector3 from '../../../dot/js/Vector3.js';
import Vector4 from '../../../dot/js/Vector4.js';

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

      if ( !expected.equalsEpsilon( actual, 1e-5 ) ) {
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
  new Vector3( 0.5, 0.5, 0.5 )
] );

vec3Test( 'oklab_to_linear_sRGB', wgsl_oklab_to_linear_sRGB, ( color: Vector3 ) => {
  return RenderColor.oklabToLinear( color.toVector4() ).toVector3();
}, [
  new Vector3( 0.9, 0.0, 0.0001 ),
  new Vector3( 0.99, 0.5, 0.002 ),
  new Vector3( 0.5, 0.5, 0.5 )
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
