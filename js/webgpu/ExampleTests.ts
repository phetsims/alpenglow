// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL example tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Binding, ComputeShader, DeviceContext, wgsl_exclusive_scan_raked_blocked_single, wgsl_exclusive_scan_raked_striped_single, wgsl_exclusive_scan_simple_single, wgsl_inclusive_scan_raked_blocked_single, wgsl_inclusive_scan_raked_striped_single, wgsl_reduce_raked_blocked, wgsl_reduce_raked_striped, wgsl_reduce_simple } from '../imports.js';
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

  const numbers = _.range( 0, inputSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'reduce_simple', wgsl_reduce_simple, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: inputSize
    }
  );

  const inputBuffer = context.createBuffer( 4 * inputSize );
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

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'reduce_raked_blocked', async device => {
  const workgroupSize = 256;
  const grainSize = 4;
  const inputSize = workgroupSize * grainSize - 27;

  const numbers = _.range( 0, inputSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'reduce_raked_blocked', wgsl_reduce_raked_blocked, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: inputSize
    }
  );

  const inputBuffer = context.createBuffer( 4 * inputSize );
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

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'reduce_raked_striped', async device => {
  const workgroupSize = 256;
  const grainSize = 4;

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const shader = ComputeShader.fromSource(
    device, 'reduce_raked_striped', wgsl_reduce_raked_striped, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize
    }
  );

  const inputBuffer = context.createBuffer( 4 * workgroupSize * grainSize );
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

  const expectedValue = _.sum( numbers );
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

  const toStripedIndex = ( i: number ) => ( i % grainSize ) * workgroupSize + Math.floor( i / grainSize );
  const fromStripedIndex = ( i: number ) => ( i % workgroupSize ) * grainSize + Math.floor( i / workgroupSize );

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );
  const stripedNumbers = numbers.map( ( n, i ) => numbers[ fromStripedIndex( i ) ] );

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
  const outputArray = stripedOutputArray.map( ( n, i ) => stripedOutputArray[ toStripedIndex( i ) ] );

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

  const toStripedIndex = ( i: number ) => ( i % grainSize ) * workgroupSize + Math.floor( i / grainSize );
  const fromStripedIndex = ( i: number ) => ( i % workgroupSize ) * grainSize + Math.floor( i / workgroupSize );

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );
  const stripedNumbers = numbers.map( ( n, i ) => numbers[ fromStripedIndex( i ) ] );

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
  const outputArray = stripedOutputArray.map( ( n, i ) => stripedOutputArray[ toStripedIndex( i ) ] );

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
