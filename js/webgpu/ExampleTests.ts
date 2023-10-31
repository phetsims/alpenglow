// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL example tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Binding, ByteEncoder, ComputeShader, DeviceContext, wgsl_exclusive_scan_raked_blocked_single, wgsl_exclusive_scan_raked_striped_single, wgsl_exclusive_scan_simple_single, wgsl_i32_merge, wgsl_i32_merge_simple, wgsl_inclusive_scan_raked_blocked_single, wgsl_inclusive_scan_raked_striped_single, wgsl_inclusive_scan_simple_single, wgsl_reduce_raked_blocked, wgsl_reduce_raked_striped, wgsl_reduce_raked_striped_blocked, wgsl_reduce_raked_striped_blocked_convergent, wgsl_reduce_simple } from '../imports.js';
import Random from '../../../dot/js/Random.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

QUnit.module( 'Example' );

// TODO: deduplicate with SnippetTests

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

asyncTestWithDevice( 'reduce_simple', async device => {
  const workgroupSize = 256;
  const inputSize = workgroupSize - 27;

  const numbers = _.range( 0, workgroupSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'reduce_simple', wgsl_reduce_simple, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: inputSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const inputBuffer = context.createBuffer( 4 * workgroupSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const outputBuffer = context.createBuffer( 4 );
  const resultBuffer = context.createMapReadableBuffer( 4 );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = _.sum( numbers.slice( 0, inputSize ) );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'reduce_raked_blocked', async device => {
  const workgroupSize = 256;
  const grainSize = 4;
  const bufferSize = workgroupSize * grainSize;
  const inputSize = bufferSize - 27;

  const numbers = _.range( 0, bufferSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'reduce_raked_blocked', wgsl_reduce_raked_blocked, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: inputSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const inputBuffer = context.createBuffer( 4 * bufferSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const outputBuffer = context.createBuffer( 4 );
  const resultBuffer = context.createMapReadableBuffer( 4 );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = _.sum( numbers.slice( 0, inputSize ) );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'reduce_raked_striped', async device => {
  const workgroupSize = 256;
  const grainSize = 4;
  const bufferSize = workgroupSize * grainSize;
  const inputSize = bufferSize - 27;

  const numbers = _.range( 0, bufferSize ).map( () => random.nextDouble() );
  const stripedNumbers = _.range( 0, bufferSize ).map( i => numbers[ ByteEncoder.fromStripedIndex( i, workgroupSize, grainSize ) ] );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'reduce_raked_striped', wgsl_reduce_raked_striped, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: inputSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const inputBuffer = context.createBuffer( 4 * bufferSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( stripedNumbers ).buffer );

  const outputBuffer = context.createBuffer( 4 );
  const resultBuffer = context.createMapReadableBuffer( 4 );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = _.sum( numbers.slice( 0, inputSize ) );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'reduce_raked_striped_blocked', async device => {
  const workgroupSize = 256;
  const grainSize = 4;
  const bufferSize = workgroupSize * grainSize;
  const inputSize = bufferSize - 27;

  const numbers = _.range( 0, bufferSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'reduce_raked_striped_blocked', wgsl_reduce_raked_striped_blocked, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: inputSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const inputBuffer = context.createBuffer( 4 * bufferSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const outputBuffer = context.createBuffer( 4 );
  const resultBuffer = context.createMapReadableBuffer( 4 );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = _.sum( numbers.slice( 0, inputSize ) );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'reduce_raked_striped_blocked_convergent', async device => {
  const workgroupSize = 256;
  const grainSize = 4;
  const bufferSize = workgroupSize * grainSize;
  const inputSize = bufferSize - 27;

  const numbers = _.range( 0, bufferSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'reduce_raked_striped_blocked_convergent', wgsl_reduce_raked_striped_blocked_convergent, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: inputSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const inputBuffer = context.createBuffer( 4 * bufferSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const outputBuffer = context.createBuffer( 4 );
  const resultBuffer = context.createMapReadableBuffer( 4 );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = _.sum( numbers.slice( 0, inputSize ) );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'exclusive_scan_simple_single', async device => {
  const workgroupSize = 256;

  const numbers = _.range( 0, workgroupSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'exclusive_scan_simple_single', wgsl_exclusive_scan_simple_single, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize
    }
  );

  const inputBuffer = context.createBuffer( 4 * workgroupSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const outputBuffer = context.createBuffer( 4 * workgroupSize );
  const resultBuffer = context.createMapReadableBuffer( 4 * workgroupSize );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'inclusive_scan_simple_single', async device => {
  const workgroupSize = 256;

  const numbers = _.range( 0, workgroupSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'inclusive_scan_simple_single', wgsl_inclusive_scan_simple_single, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize
    }
  );

  const inputBuffer = context.createBuffer( 4 * workgroupSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const outputBuffer = context.createBuffer( 4 * workgroupSize );
  const resultBuffer = context.createMapReadableBuffer( 4 * workgroupSize );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i + 1 ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'exclusive_scan_raked_blocked_single', async device => {
  const workgroupSize = 256;
  const grainSize = 4;

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'exclusive_scan_raked_blocked_single', wgsl_exclusive_scan_raked_blocked_single, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize
    }
  );

  const inputBuffer = context.createBuffer( 4 * workgroupSize * grainSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const outputBuffer = context.createBuffer( 4 * workgroupSize * grainSize );
  const resultBuffer = context.createMapReadableBuffer( 4 * workgroupSize * grainSize );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'inclusive_scan_raked_blocked_single', async device => {
  const workgroupSize = 256;
  const grainSize = 4;

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'inclusive_scan_raked_blocked_single', wgsl_inclusive_scan_raked_blocked_single, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize
    }
  );

  const inputBuffer = context.createBuffer( 4 * workgroupSize * grainSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const outputBuffer = context.createBuffer( 4 * workgroupSize * grainSize );
  const resultBuffer = context.createMapReadableBuffer( 4 * workgroupSize * grainSize );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i + 1 ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'exclusive_scan_raked_striped_single', async device => {
  const workgroupSize = 256;
  const grainSize = 4;

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );
  const stripedNumbers = numbers.map( ( n, i ) => numbers[ ByteEncoder.fromStripedIndex( i, workgroupSize, grainSize ) ] );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'exclusive_scan_raked_striped_single', wgsl_exclusive_scan_raked_striped_single, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize
    }
  );

  const inputBuffer = context.createBuffer( 4 * workgroupSize * grainSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( stripedNumbers ).buffer );

  const outputBuffer = context.createBuffer( 4 * workgroupSize * grainSize );
  const resultBuffer = context.createMapReadableBuffer( 4 * workgroupSize * grainSize );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const stripedOutputArray = await DeviceContext.getMappedFloatArray( resultBuffer );
  const outputArray = stripedOutputArray.map( ( n, i ) => stripedOutputArray[ ByteEncoder.toStripedIndex( i, workgroupSize, grainSize ) ] );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'inclusive_scan_raked_striped_single', async device => {
  const workgroupSize = 256;
  const grainSize = 4;

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );
  const stripedNumbers = numbers.map( ( n, i ) => numbers[ ByteEncoder.fromStripedIndex( i, workgroupSize, grainSize ) ] );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'inclusive_scan_raked_striped_single', wgsl_inclusive_scan_raked_striped_single, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize
    }
  );

  const inputBuffer = context.createBuffer( 4 * workgroupSize * grainSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( stripedNumbers ).buffer );

  const outputBuffer = context.createBuffer( 4 * workgroupSize * grainSize );
  const resultBuffer = context.createMapReadableBuffer( 4 * workgroupSize * grainSize );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const stripedOutputArray = await DeviceContext.getMappedFloatArray( resultBuffer );
  const outputArray = stripedOutputArray.map( ( n, i ) => stripedOutputArray[ ByteEncoder.toStripedIndex( i, workgroupSize, grainSize ) ] );

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i + 1 ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'double reduce_simple', async device => {
  const workgroupSize = 256;
  const inputSize = workgroupSize * workgroupSize - 27 * 301;

  const numbers = _.range( 0, inputSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader0 = ComputeShader.fromSource(
    device, 'reduce_simple 0', wgsl_reduce_simple, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: inputSize, // TODO: more dynamic range checks
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader1 = ComputeShader.fromSource(
    device, 'reduce_simple 1', wgsl_reduce_simple, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: Math.ceil( inputSize / workgroupSize ),
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const inputBuffer = context.createBuffer( 4 * inputSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const middleBuffer = context.createBuffer( 4 * Math.ceil( inputSize / workgroupSize ) );
  const outputBuffer = context.createBuffer( 4 );
  const resultBuffer = context.createMapReadableBuffer( 4 );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader0.dispatch( encoder, [
    inputBuffer, middleBuffer
  ], Math.ceil( inputSize / workgroupSize ) );
  shader1.dispatch( encoder, [
    middleBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  middleBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-2 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'triple reduce_simple', async device => {
  const workgroupSize = 256;
  const inputSize = workgroupSize * workgroupSize * 27 - 27 * 301;

  const numbers = _.range( 0, inputSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader0 = ComputeShader.fromSource(
    device, 'reduce_simple 0', wgsl_reduce_simple, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: inputSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader1 = ComputeShader.fromSource(
    device, 'reduce_simple 1', wgsl_reduce_simple, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: Math.ceil( inputSize / workgroupSize ),
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader2 = ComputeShader.fromSource(
    device, 'reduce_simple 2', wgsl_reduce_simple, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize ) ),
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const inputBuffer = context.createBuffer( 4 * inputSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const firstMiddleBuffer = context.createBuffer( 4 * Math.ceil( inputSize / workgroupSize ) );
  const secondMiddleBuffer = context.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize ) ) );
  const outputBuffer = context.createBuffer( 4 );
  const resultBuffer = context.createMapReadableBuffer( 4 );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader0.dispatch( encoder, [
    inputBuffer, firstMiddleBuffer
  ], Math.ceil( inputSize / workgroupSize ) );
  shader1.dispatch( encoder, [
    firstMiddleBuffer, secondMiddleBuffer
  ], Math.ceil( inputSize / ( workgroupSize * workgroupSize ) ) );
  shader2.dispatch( encoder, [
    secondMiddleBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  firstMiddleBuffer.destroy();
  secondMiddleBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-1 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'triple reduce_raked_blocked', async device => {
  const workgroupSize = 256;
  const grainSize = 5;
  const inputSize = workgroupSize * workgroupSize * 27 - 27 * 301;

  const numbers = _.range( 0, inputSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader0 = ComputeShader.fromSource(
    device, 'reduce_raked_blocked 0', wgsl_reduce_raked_blocked, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: inputSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader1 = ComputeShader.fromSource(
    device, 'reduce_raked_blocked 1', wgsl_reduce_raked_blocked, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: Math.ceil( inputSize / ( workgroupSize * grainSize ) ),
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader2 = ComputeShader.fromSource(
    device, 'reduce_raked_blocked 2', wgsl_reduce_raked_blocked, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ),
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const inputBuffer = context.createBuffer( 4 * inputSize );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const firstMiddleBuffer = context.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
  const secondMiddleBuffer = context.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ) );
  const outputBuffer = context.createBuffer( 4 );
  const resultBuffer = context.createMapReadableBuffer( 4 );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader0.dispatch( encoder, [
    inputBuffer, firstMiddleBuffer
  ], Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
  shader1.dispatch( encoder, [
    firstMiddleBuffer, secondMiddleBuffer
  ], Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ) );
  shader2.dispatch( encoder, [
    secondMiddleBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

  inputBuffer.destroy();
  firstMiddleBuffer.destroy();
  secondMiddleBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-1 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'i32_merge_simple', async device => {
  const workgroupSize = 64;
  const grainSize = 8;
  const a = _.range( 0, 1300 ).map( () => random.nextIntBetween( 0, 2000 ) ).sort( ( a, b ) => a - b );
  const b = _.range( 0, 1000 ).map( () => random.nextIntBetween( 0, 2000 ) ).sort( ( a, b ) => a - b );

  const length = a.length + b.length;
  const dispatchSize = Math.ceil( length / ( workgroupSize * grainSize ) );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'i32_merge_simple', wgsl_i32_merge_simple, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      sizeA: a.length,
      sizeB: b.length
    }
  );

  const aBuffer = context.createBuffer( 4 * a.length );
  device.queue.writeBuffer( aBuffer, 0, new Int32Array( a ).buffer );
  const bBuffer = context.createBuffer( 4 * b.length );
  device.queue.writeBuffer( bBuffer, 0, new Int32Array( b ).buffer );

  const outputBuffer = context.createBuffer( 4 * length );
  const resultBuffer = context.createMapReadableBuffer( 4 * length );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    aBuffer, bBuffer, outputBuffer
  ], dispatchSize );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedIntArray( resultBuffer );

  aBuffer.destroy();
  bBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = [ ...a, ...b ].sort( ( a, b ) => a - b );
  const actualValue = [ ...outputArray ].slice( 0, length );

  for ( let i = 0; i < length; i++ ) {
    const expected = expectedValue[ i ];
    const actual = actualValue[ i ];

    if ( Math.abs( expected - actual ) > 1e-4 ) {
      return `${i}: expected ${expected}, actual ${actual}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'i32_merge', async device => {
  const workgroupSize = 32;
  const sharedMemorySize = workgroupSize * 4;
  const blockOutputSize = sharedMemorySize * 2;
  const a = _.range( 0, 1300 ).map( () => random.nextIntBetween( 0, 2000 ) ).sort( ( a, b ) => a - b );
  const b = _.range( 0, 1000 ).map( () => random.nextIntBetween( 0, 3000 ) ).sort( ( a, b ) => a - b );
  // const a = [0,0,2,4,4,4,5,6,8,12,14,14,17,20,20,21,22,24,31,38,39,41,43,43,43,44,45,45,47,47,48,48,58,59,59,59,60,61,62,62,64,67,70,72,72,72,78,80,80,81,84,84,85,86,86,87,87,87,88,91,91,94,94,95,101,101,101,102,102,104,106,107,110,111,113,115,116,117,117,119,121,122,125,126,127,127,129,134,136,139,140,141,142,142,143,144,148,152,152,154,162,164,164,165,165,171,175,176,177,179,180,181,181,185,185,186,189,189,189,192,195,197,197,198,198,198,202,203,204,205,206,208,210,211,213,217,223,224,224,225,226,226,227,228,228,231,236,236,237,238,238,238,240,242,245,247,249,249,253,255,256,256,256,258,259,260,264,265,266,267,268,270,270,270,270,272,273,278,281,283,285,286,287,288,288,289,293,295,296,296,300,300,300,305,307,310,311,312,313,315,315,316,317,317,318,319,320,321,322,324,325,327,328,328,329,329,331,331,333,335,335,335,338,340,341,342,342,342,343,343,343,344,347,348,349,349,349,351,352,353,354,356,356,356,360,361,362,367,370,374,375,376,378,381,383,383,383,386,390,397,398,399,400,400,404,404,408,408,409,411,412,412,415,416,418,421,421,422,424,424,427,430,431,433,438,439,443,443,445,448,449,453,453,459,459,461,462,467,467,468,468,470,471,473,474,474,475,475,478,479,481,483,484,484,484,485,486,488,489,490,491,492,493,494,494,495,498,498,499,507,507,508,509,510,510,512,514,518,519,520,521,523,523,526,527,527,528,530,531,531,532,535,537,538,541,541,542,543,543,543,548,549,551,553,553,555,555,556,557,558,558,560,562,562,563,564,568,570,570,573,573,574,576,578,579,579,581,583,583,585,587,589,589,592,592,593,595,598,599,599,599,599,602,604,606,607,607,607,607,609,612,617,619,619,624,625,625,626,627,628,630,632,632,633,635,635,636,636,637,637,639,642,642,643,645,646,647,649,650,651,652,661,666,667,668,668,669,671,671,674,675,675,677,677,678,679,681,686,687,688,690,692,695,698,702,710,710,711,712,712,713,718,718,718,718,719,720,721,721,724,725,725,727,729,730,731,732,733,736,737,737,740,742,744,745,746,747,749,749,753,753,755,756,758,764,765,771,771,771,772,773,776,776,776,776,778,778,780,781,782,783,783,791,792,797,802,803,804,805,806,807,808,808,810,810,811,813,815,818,820,821,823,824,825,827,828,828,830,831,832,835,836,837,840,842,842,846,846,850,853,856,858,858,858,861,862,863,863,864,870,870,874,874,878,879,882,885,885,886,886,887,889,890,891,891,892,895,896,897,900,902,903,904,906,908,908,908,909,910,911,912,912,915,916,917,918,918,920,924,925,925,927,928,931,931,933,935,939,940,942,943,945,948,952,952,955,956,957,958,958,959,960,960,961,961,961,967,975,976,978,982,983,983,984,984,986,986,987,990,991,995,998,999,999,1001,1001,1006,1008,1010,1010,1013,1014,1014,1016,1019,1020,1021,1027,1029,1030,1032,1034,1035,1037,1037,1038,1048,1052,1052,1052,1053,1055,1058,1059,1059,1061,1061,1062,1066,1066,1069,1070,1074,1074,1075,1075,1077,1079,1085,1086,1086,1087,1088,1089,1095,1096,1097,1099,1099,1102,1103,1103,1106,1108,1111,1113,1114,1115,1115,1115,1116,1116,1117,1118,1119,1120,1122,1122,1122,1124,1125,1126,1129,1131,1132,1133,1137,1138,1138,1142,1142,1144,1144,1145,1150,1150,1150,1151,1152,1154,1154,1155,1157,1158,1159,1160,1167,1168,1170,1170,1170,1173,1174,1176,1177,1181,1182,1184,1186,1186,1186,1190,1191,1192,1194,1195,1195,1199,1204,1207,1208,1211,1212,1213,1215,1217,1218,1218,1220,1224,1227,1229,1230,1231,1233,1236,1239,1239,1240,1240,1242,1242,1244,1245,1248,1248,1251,1251,1255,1260,1263,1263,1266,1270,1272,1272,1277,1277,1277,1277,1283,1283,1284,1284,1285,1285,1286,1288,1289,1292,1292,1292,1293,1293,1295,1296,1296,1296,1297,1298,1299,1299,1310,1313,1313,1313,1314,1318,1319,1320,1321,1326,1331,1331,1332,1333,1336,1337,1341,1343,1344,1344,1345,1348,1348,1348,1349,1352,1352,1354,1356,1357,1357,1359,1360,1360,1361,1361,1361,1366,1370,1371,1372,1372,1373,1374,1374,1376,1380,1381,1381,1382,1393,1395,1398,1400,1400,1401,1407,1408,1409,1410,1411,1413,1413,1415,1415,1415,1417,1417,1421,1424,1424,1428,1428,1429,1429,1435,1438,1439,1440,1441,1442,1442,1445,1450,1450,1451,1451,1457,1459,1459,1462,1462,1463,1468,1469,1472,1474,1474,1476,1478,1481,1482,1482,1485,1488,1489,1489,1489,1490,1490,1493,1494,1495,1498,1503,1505,1505,1509,1509,1512,1516,1518,1518,1518,1519,1519,1519,1519,1520,1520,1521,1521,1522,1525,1527,1527,1528,1530,1532,1532,1533,1533,1536,1540,1543,1544,1548,1550,1552,1552,1553,1557,1558,1561,1562,1566,1567,1568,1571,1571,1573,1574,1574,1575,1577,1578,1578,1579,1580,1581,1582,1582,1584,1585,1585,1587,1588,1594,1598,1603,1605,1605,1606,1612,1614,1614,1614,1615,1615,1616,1619,1619,1621,1621,1622,1624,1627,1628,1630,1632,1633,1634,1635,1636,1636,1638,1640,1640,1641,1642,1642,1644,1650,1650,1651,1652,1652,1653,1653,1656,1661,1664,1665,1666,1670,1670,1674,1677,1677,1683,1684,1685,1685,1685,1686,1686,1687,1690,1691,1694,1697,1697,1698,1699,1700,1704,1704,1704,1705,1706,1707,1710,1711,1712,1717,1718,1718,1718,1718,1720,1722,1723,1724,1727,1728,1729,1733,1733,1734,1736,1736,1737,1738,1740,1742,1742,1744,1745,1748,1749,1749,1750,1756,1757,1759,1761,1761,1761,1764,1765,1766,1767,1767,1768,1769,1769,1770,1771,1771,1772,1773,1774,1774,1775,1777,1777,1779,1779,1779,1785,1786,1786,1788,1793,1794,1795,1796,1797,1797,1798,1799,1800,1800,1804,1804,1805,1810,1810,1815,1817,1817,1819,1819,1821,1822,1822,1822,1822,1823,1825,1826,1826,1828,1828,1829,1829,1829,1830,1830,1833,1834,1834,1835,1835,1836,1838,1840,1841,1842,1844,1845,1846,1846,1846,1850,1854,1857,1860,1860,1861,1862,1862,1864,1866,1866,1867,1870,1870,1870,1870,1874,1874,1875,1878,1881,1883,1884,1886,1887,1890,1893,1893,1894,1898,1899,1900,1902,1904,1907,1908,1909,1911,1912,1912,1913,1913,1913,1916,1918,1919,1919,1920,1921,1921,1921,1922,1931,1931,1933,1933,1934,1935,1936,1941,1942,1942,1944,1946,1947,1950,1952,1955,1957,1957,1963,1964,1964,1965,1966,1971,1973,1974,1978,1980,1981,1981,1984,1984,1986,1987,1988,1989,1991,1992,1993,1993,1994,1994];
  // const b = [4,5,7,9,11,24,34,36,40,41,41,53,55,59,62,62,63,66,70,72,73,79,79,80,80,83,85,87,88,89,91,93,95,102,106,106,107,111,113,115,116,120,125,129,131,133,138,139,139,141,143,144,149,149,150,156,159,159,161,172,174,175,182,183,183,183,185,189,191,192,195,199,199,201,202,202,203,203,204,205,206,221,223,224,226,227,227,228,229,233,236,241,243,249,253,254,254,258,261,261,267,269,273,276,283,290,290,291,295,301,303,314,315,317,319,324,325,326,328,336,345,347,353,357,359,363,367,381,381,390,398,399,400,400,403,412,415,417,418,429,442,442,444,445,447,451,451,455,466,471,473,474,474,478,478,479,480,482,483,483,484,485,486,492,493,495,498,499,506,508,508,510,512,513,520,520,524,524,526,527,528,529,535,536,537,538,538,543,547,556,557,559,560,563,565,565,567,569,569,577,577,580,581,581,583,589,590,591,592,597,599,600,600,605,605,609,609,611,612,612,616,624,626,637,644,646,646,649,650,654,654,660,669,670,672,679,681,683,685,685,700,701,701,702,703,705,706,707,708,718,719,725,735,736,739,741,741,744,745,745,752,753,757,761,761,761,762,762,762,764,764,769,771,774,774,784,786,793,793,794,794,796,797,798,800,802,805,808,810,811,812,815,817,818,818,819,820,826,829,832,834,834,838,839,841,841,842,844,847,847,848,860,861,863,866,868,871,873,873,877,879,881,885,889,893,898,898,911,913,917,917,924,928,932,934,935,936,939,943,949,954,955,958,959,960,962,966,974,978,985,986,986,987,988,995,1006,1007,1008,1009,1010,1010,1012,1015,1016,1017,1019,1023,1028,1030,1038,1044,1045,1045,1045,1046,1051,1064,1068,1070,1072,1072,1075,1080,1081,1084,1092,1093,1097,1099,1101,1106,1108,1108,1108,1115,1119,1127,1129,1136,1139,1142,1149,1150,1151,1151,1153,1154,1157,1158,1161,1163,1168,1171,1183,1185,1187,1188,1188,1194,1196,1208,1213,1214,1217,1221,1232,1233,1233,1235,1241,1245,1245,1247,1247,1251,1262,1262,1262,1265,1268,1276,1277,1279,1282,1285,1286,1289,1291,1292,1295,1299,1303,1306,1308,1315,1317,1318,1322,1324,1328,1329,1335,1336,1337,1342,1346,1346,1351,1356,1358,1361,1365,1366,1367,1370,1375,1378,1378,1380,1384,1386,1389,1396,1398,1400,1402,1402,1407,1408,1409,1410,1414,1420,1428,1432,1432,1435,1442,1442,1443,1448,1449,1449,1449,1451,1454,1454,1457,1458,1460,1461,1465,1473,1483,1484,1485,1493,1498,1502,1503,1511,1513,1527,1529,1532,1543,1547,1550,1550,1552,1553,1556,1563,1567,1568,1571,1571,1571,1572,1575,1576,1577,1577,1583,1588,1591,1596,1598,1602,1603,1605,1606,1614,1623,1626,1626,1629,1635,1635,1640,1641,1643,1647,1675,1675,1678,1679,1681,1691,1691,1693,1695,1697,1697,1700,1710,1718,1730,1737,1737,1741,1743,1744,1746,1749,1750,1751,1752,1755,1758,1758,1759,1767,1770,1770,1773,1779,1786,1788,1793,1798,1804,1806,1811,1815,1816,1823,1823,1827,1828,1828,1828,1829,1830,1833,1845,1845,1848,1852,1861,1862,1863,1864,1866,1866,1867,1867,1875,1879,1889,1891,1898,1901,1902,1907,1909,1917,1922,1930,1933,1934,1936,1939,1944,1952,1953,1953,1955,1956,1960,1962,1965,1967,1968,1968,1975,1976,1978,1980,1980,1981,1982,1984,1988,1991,1996,1996,1997,1997,2006,2008,2020,2021,2023,2024,2025,2027,2028,2031,2031,2032,2041,2044,2046,2047,2047,2052,2054,2057,2070,2073,2073,2079,2081,2082,2084,2086,2086,2086,2088,2091,2092,2098,2100,2102,2105,2108,2110,2115,2117,2120,2122,2122,2124,2129,2130,2131,2132,2152,2154,2165,2167,2171,2180,2181,2183,2184,2190,2190,2194,2198,2200,2206,2216,2217,2220,2223,2225,2225,2227,2230,2231,2234,2235,2242,2243,2243,2246,2251,2257,2258,2259,2267,2269,2277,2279,2279,2281,2286,2287,2288,2290,2293,2296,2297,2298,2300,2305,2307,2308,2309,2314,2314,2316,2316,2317,2319,2327,2329,2330,2331,2332,2333,2333,2334,2335,2339,2339,2343,2349,2351,2351,2352,2354,2371,2378,2380,2381,2381,2382,2384,2386,2392,2393,2396,2404,2405,2412,2412,2417,2425,2427,2427,2427,2434,2446,2446,2452,2452,2453,2457,2458,2464,2468,2469,2469,2472,2477,2482,2486,2490,2490,2491,2497,2497,2498,2498,2498,2505,2507,2516,2519,2519,2522,2528,2532,2533,2539,2545,2548,2548,2550,2550,2550,2553,2556,2559,2562,2565,2568,2568,2570,2572,2573,2573,2584,2584,2586,2587,2590,2592,2593,2602,2604,2605,2608,2614,2617,2617,2619,2622,2622,2624,2626,2634,2638,2639,2644,2647,2656,2657,2659,2661,2665,2675,2676,2676,2687,2689,2689,2697,2708,2720,2721,2725,2727,2732,2733,2735,2747,2758,2761,2774,2775,2781,2781,2781,2782,2785,2786,2787,2789,2793,2793,2796,2805,2808,2808,2808,2810,2820,2822,2826,2829,2830,2831,2832,2835,2836,2836,2854,2857,2857,2858,2861,2863,2863,2867,2871,2874,2874,2874,2874,2876,2879,2882,2883,2886,2888,2891,2893,2895,2898,2899,2900,2904,2905,2909,2909,2913,2918,2920,2928,2932,2933,2933,2938,2938,2945,2948,2951,2956,2957,2958,2959,2960,2962,2964,2967,2968,2971,2974,2977,2980,2984,2984,2984,2992,2997,2999];

  const length = a.length + b.length;
  const dispatchSize = Math.ceil( length / blockOutputSize );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'i32_merge', wgsl_i32_merge, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      sharedMemorySize: sharedMemorySize,
      blockOutputSize: blockOutputSize,
      lengthA: a.length,
      lengthB: b.length
    }
  );

  const aBuffer = context.createBuffer( 4 * a.length );
  device.queue.writeBuffer( aBuffer, 0, new Int32Array( a ).buffer );
  const bBuffer = context.createBuffer( 4 * b.length );
  device.queue.writeBuffer( bBuffer, 0, new Int32Array( b ).buffer );

  const outputBuffer = context.createBuffer( 4 * length );
  const resultBuffer = context.createMapReadableBuffer( 4 * length );

  const encoder = device.createCommandEncoder( { label: 'the encoder' } );

  shader.dispatch( encoder, [
    aBuffer, bBuffer, outputBuffer
  ], dispatchSize );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  const outputArray = await DeviceContext.getMappedIntArray( resultBuffer );

  aBuffer.destroy();
  bBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = [ ...a, ...b ].sort( ( a, b ) => a - b );
  const actualValue = [ ...outputArray ].slice( 0, length );

  for ( let i = 0; i < length; i++ ) {
    const expected = expectedValue[ i ];
    const actual = actualValue[ i ];

    if ( Math.abs( expected - actual ) > 1e-4 ) {
      console.log( 'expected' );
      console.log( _.chunk( expectedValue, 32 ) );

      console.log( 'a' );
      console.log( _.chunk( a, 32 ) );
      // console.log( _.chunk( a, 32 ).slice( 0, 4 ) );

      console.log( 'b' );
      console.log( _.chunk( b, 32 ) );
      // console.log( _.chunk( b, 32 ).slice( 0, 4 ) );

      console.log( 'actual' );
      console.log( _.chunk( actualValue, 32 ) );
      return `${i}: expected ${expected}, actual ${actual}`;
    }
  }

  return null;
} );
