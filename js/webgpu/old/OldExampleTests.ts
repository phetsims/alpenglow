// Copyright 2023-2024, University of Colorado Boulder

/**
 * Assorted WGSL example tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { asyncTestWithDevice, ByteEncoder, DeviceContext, OldBindingType, OldComputeShader, OldDualSnippetSource, u32, wgsl_example_load_reduced, wgsl_f32_exclusive_scan_raked_blocked_single, wgsl_f32_exclusive_scan_raked_striped_single, wgsl_f32_exclusive_scan_simple_single, wgsl_f32_inclusive_scan_raked_blocked_single, wgsl_f32_inclusive_scan_raked_striped_single, wgsl_f32_inclusive_scan_simple_single, wgsl_f32_reduce_simple, wgsl_u32_atomic_reduce_raked_striped_blocked_convergent, wgsl_u32_compact_single_radix_sort, wgsl_u32_compact_workgroup_radix_sort, wgsl_u32_flip_convergent, wgsl_u32_from_striped, wgsl_u32_radix_histogram, wgsl_u32_reduce_raked_striped_blocked_convergent, wgsl_u32_single_radix_sort, wgsl_u32_to_striped, wgsl_u32_workgroup_radix_sort } from '../../imports.js';
import Random from '../../../../dot/js/Random.js';
import Vector2 from '../../../../dot/js/Vector2.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

QUnit.module( 'Example' );

asyncTestWithDevice( 'u32_reduce_raked_striped_blocked_convergent', async ( device, deviceContext ) => {
  const workgroupSize = 256;
  const grainSize = 4;
  const bufferSize = workgroupSize * grainSize;
  const inputSize = bufferSize - 27;

  const numbers = _.range( 0, bufferSize ).map( () => random.nextIntBetween( 1, 10 ) );

  const shader = OldComputeShader.fromSource(
    device, 'u32_reduce_raked_striped_blocked_convergent', wgsl_u32_reduce_raked_striped_blocked_convergent, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: inputSize,
      identity: '0u',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createU32Buffer( numbers );
    const outputBuffer = execution.createBuffer( 4 );

    shader.dispatch( encoder, [
      inputBuffer, outputBuffer
    ] );

    return execution.u32Numbers( outputBuffer );
  } );

  const expectedValue = _.sum( numbers.slice( 0, inputSize ) );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'f32_exclusive_scan_simple_single', async ( device, deviceContext ) => {
  const workgroupSize = 256;

  const numbers = _.range( 0, workgroupSize ).map( () => random.nextDouble() );


  const shader = OldComputeShader.fromSource(
    device, 'f32_exclusive_scan_simple_single', wgsl_f32_exclusive_scan_simple_single, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize
    }
  );

  const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createF32Buffer( numbers );
    const outputBuffer = execution.createBuffer( 4 * workgroupSize );

    shader.dispatch( encoder, [
      inputBuffer, outputBuffer
    ] );

    return execution.f32Numbers( outputBuffer );
  } );

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'f32_inclusive_scan_simple_single', async ( device, deviceContext ) => {
  const workgroupSize = 256;

  const numbers = _.range( 0, workgroupSize ).map( () => random.nextDouble() );


  const shader = OldComputeShader.fromSource(
    device, 'f32_inclusive_scan_simple_single', wgsl_f32_inclusive_scan_simple_single, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize
    }
  );

  const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createF32Buffer( numbers );
    const outputBuffer = execution.createBuffer( 4 * workgroupSize );

    shader.dispatch( encoder, [
      inputBuffer, outputBuffer
    ] );

    return execution.f32Numbers( outputBuffer );
  } );

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i + 1 ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'f32_exclusive_scan_raked_blocked_single', async ( device, deviceContext ) => {
  const workgroupSize = 256;
  const grainSize = 4;

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );


  const shader = OldComputeShader.fromSource(
    device, 'f32_exclusive_scan_raked_blocked_single', wgsl_f32_exclusive_scan_raked_blocked_single, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize
    }
  );

  const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createF32Buffer( numbers );
    const outputBuffer = execution.createBuffer( 4 * workgroupSize * grainSize );

    shader.dispatch( encoder, [
      inputBuffer, outputBuffer
    ] );

    return execution.f32Numbers( outputBuffer );
  } );

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'inclusive_scan_raked_blocked_single', async ( device, deviceContext ) => {
  const workgroupSize = 256;
  const grainSize = 4;

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );


  const shader = OldComputeShader.fromSource(
    device, 'inclusive_scan_raked_blocked_single', wgsl_f32_inclusive_scan_raked_blocked_single, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize
    }
  );

  const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createF32Buffer( numbers );
    const outputBuffer = execution.createBuffer( 4 * workgroupSize * grainSize );

    shader.dispatch( encoder, [
      inputBuffer, outputBuffer
    ] );

    return execution.f32Numbers( outputBuffer );
  } );

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i + 1 ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'f32_exclusive_scan_raked_striped_single', async ( device, deviceContext ) => {
  const workgroupSize = 256;
  const grainSize = 4;

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );
  const stripedNumbers = numbers.map( ( n, i ) => numbers[ ByteEncoder.fromStripedIndex( i, workgroupSize, grainSize ) ] );


  const shader = OldComputeShader.fromSource(
    device, 'f32_exclusive_scan_raked_striped_single', wgsl_f32_exclusive_scan_raked_striped_single, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize
    }
  );

  const stripedOutputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createF32Buffer( stripedNumbers );
    const outputBuffer = execution.createBuffer( 4 * workgroupSize * grainSize );

    shader.dispatch( encoder, [
      inputBuffer, outputBuffer
    ] );

    return execution.f32Numbers( outputBuffer );
  } );
  const outputArray = stripedOutputArray.map( ( n, i ) => stripedOutputArray[ ByteEncoder.toStripedIndex( i, workgroupSize, grainSize ) ] );

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'f32_inclusive_scan_raked_striped_single', async ( device, deviceContext ) => {
  const workgroupSize = 256;
  const grainSize = 4;

  const numbers = _.range( 0, workgroupSize * grainSize ).map( () => random.nextDouble() );
  const stripedNumbers = numbers.map( ( n, i ) => numbers[ ByteEncoder.fromStripedIndex( i, workgroupSize, grainSize ) ] );


  const shader = OldComputeShader.fromSource(
    device, 'f32_inclusive_scan_raked_striped_single', wgsl_f32_inclusive_scan_raked_striped_single, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize
    }
  );

  const stripedOutputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createF32Buffer( stripedNumbers );
    const outputBuffer = execution.createBuffer( 4 * workgroupSize * grainSize );

    shader.dispatch( encoder, [
      inputBuffer, outputBuffer
    ] );

    return execution.f32Numbers( outputBuffer );
  } );
  const outputArray = stripedOutputArray.map( ( n, i ) => stripedOutputArray[ ByteEncoder.toStripedIndex( i, workgroupSize, grainSize ) ] );

  for ( let i = 0; i < workgroupSize; i++ ) {
    const expectedValue = _.sum( numbers.slice( 0, i + 1 ) );
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
} );

asyncTestWithDevice( 'double f32_reduce_simple', async ( device, deviceContext ) => {
  const workgroupSize = 256;
  const inputSize = workgroupSize * workgroupSize - 27 * 301;

  const numbers = _.range( 0, inputSize ).map( () => random.nextDouble() );


  const shader0 = OldComputeShader.fromSource(
    device, 'f32_reduce_simple 0', wgsl_f32_reduce_simple, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: inputSize, // TODO: more dynamic range checks
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader1 = OldComputeShader.fromSource(
    device, 'f32_reduce_simple 1', wgsl_f32_reduce_simple, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: Math.ceil( inputSize / workgroupSize ),
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createF32Buffer( numbers );
    const middleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / workgroupSize ) );
    const outputBuffer = execution.createBuffer( 4 );

    shader0.dispatch( encoder, [
      inputBuffer, middleBuffer
    ], Math.ceil( inputSize / workgroupSize ) );
    shader1.dispatch( encoder, [
      middleBuffer, outputBuffer
    ] );

    return execution.f32Numbers( outputBuffer );
  } );

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-2 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'triple f32_reduce_simple', async ( device, deviceContext ) => {
  const workgroupSize = 256;
  const inputSize = workgroupSize * workgroupSize * 27 - 27 * 301;

  const numbers = _.range( 0, inputSize ).map( () => random.nextDouble() );


  const shader0 = OldComputeShader.fromSource(
    device, 'f32_reduce_simple 0', wgsl_f32_reduce_simple, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: inputSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader1 = OldComputeShader.fromSource(
    device, 'f32_reduce_simple 1', wgsl_f32_reduce_simple, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: Math.ceil( inputSize / workgroupSize ),
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader2 = OldComputeShader.fromSource(
    device, 'f32_reduce_simple 2', wgsl_f32_reduce_simple, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize ) ),
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createF32Buffer( numbers );
    const firstMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / workgroupSize ) );
    const secondMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize ) ) );
    const outputBuffer = deviceContext.createBuffer( 4 );

    shader0.dispatch( encoder, [
      inputBuffer, firstMiddleBuffer
    ], Math.ceil( inputSize / workgroupSize ) );
    shader1.dispatch( encoder, [
      firstMiddleBuffer, secondMiddleBuffer
    ], Math.ceil( inputSize / ( workgroupSize * workgroupSize ) ) );
    shader2.dispatch( encoder, [
      secondMiddleBuffer, outputBuffer
    ] );

    return execution.f32Numbers( outputBuffer );
  } );

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-1 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'triple u32_reduce_raked_striped_blocked_convergent', async ( device, deviceContext ) => {
  const workgroupSize = 256;
  const grainSize = 5;
  const inputSize = workgroupSize * workgroupSize * 27 - 27 * 301;

  const numbers = _.range( 0, inputSize ).map( () => random.nextIntBetween( 1, 10 ) );


  const shader0 = OldComputeShader.fromSource(
    device, 'u32_reduce_raked_striped_blocked_convergent 0', wgsl_u32_reduce_raked_striped_blocked_convergent, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: inputSize,
      identity: '0u',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader1 = OldComputeShader.fromSource(
    device, 'u32_reduce_raked_striped_blocked_convergent 1', wgsl_u32_reduce_raked_striped_blocked_convergent, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: Math.ceil( inputSize / ( workgroupSize * grainSize ) ),
      identity: '0u',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );
  const shader2 = OldComputeShader.fromSource(
    device, 'u32_reduce_raked_striped_blocked_convergent 2', wgsl_u32_reduce_raked_striped_blocked_convergent, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ),
      identity: '0u',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createU32Buffer( numbers );
    const firstMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
    const secondMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ) );
    const outputBuffer = deviceContext.createBuffer( 4 );

    shader0.dispatch( encoder, [
      inputBuffer, firstMiddleBuffer
    ], Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
    shader1.dispatch( encoder, [
      firstMiddleBuffer, secondMiddleBuffer
    ], Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ) );
    shader2.dispatch( encoder, [
      secondMiddleBuffer, outputBuffer
    ] );

    return execution.u32Numbers( outputBuffer );
  } );

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-1 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

asyncTestWithDevice( 'triple-size u32_atomic_reduce_raked_striped_blocked_convergent', async ( device, deviceContext ) => {
  const workgroupSize = 256;
  const grainSize = 5;
  const inputSize = workgroupSize * workgroupSize * 27 - 27 * 301;

  const numbers = _.range( 0, inputSize ).map( () => random.nextIntBetween( 1, 10 ) );


  const shader = OldComputeShader.fromSource(
    device, 'u32_atomic_reduce_raked_striped_blocked_convergent 0', wgsl_u32_atomic_reduce_raked_striped_blocked_convergent, [
      OldBindingType.READ_ONLY_STORAGE_BUFFER,
      OldBindingType.STORAGE_BUFFER
    ], {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      inputSize: inputSize,
      identity: '0u',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    }
  );

  const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
    const inputBuffer = execution.createU32Buffer( numbers );
    const outputBuffer = deviceContext.createBuffer( 4 );

    shader.dispatch( encoder, [
      inputBuffer, outputBuffer
    ], Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );

    return execution.u32Numbers( outputBuffer );
  } );

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-1 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );

const testSort = async (
  numbers: number[],
  sort: ( numbers: number[] ) => Promise<number[]>
) => {
  const outputArray = await sort( numbers );
  const sortedNumbers = numbers.slice().sort( ( a, b ) => a - b );

  for ( let i = 0; i < numbers.length; i++ ) {
    const expectedValue = sortedNumbers[ i ];
    const actualValue = outputArray[ i ];

    if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
      console.log( 'unsorted' );
      console.log( _.chunk( numbers, 16 ) );

      console.log( 'expected' );
      console.log( _.chunk( sortedNumbers, 16 ) );

      console.log( 'actual' );
      console.log( _.chunk( outputArray, 16 ) );

      console.log( 'bits 0' );
      console.log( _.chunk( numbers.map( n => n & 0x3 ), 16 ) );
      console.log(
        numbers.filter( n => ( n & 0x3 ) === 0 ).length,
        numbers.filter( n => ( n & 0x3 ) === 1 ).length,
        numbers.filter( n => ( n & 0x3 ) === 2 ).length,
        numbers.filter( n => ( n & 0x3 ) === 3 ).length
      );

      return `expected ${expectedValue}, actual ${actualValue}`;
    }
  }

  return null;
};

const runU32MapShader = (
  deviceContext: DeviceContext,
  shader: OldComputeShader
): ( ( numbers: number[] ) => Promise<number[]> ) => {
  return ( numbers: number[] ) => deviceContext.executeSingle( ( encoder, execution ) => {
    const inputBuffer = execution.createU32Buffer( numbers );
    const outputBuffer = execution.createBuffer( 4 * numbers.length );

    shader.dispatch( encoder, [
      inputBuffer, outputBuffer
    ] );

    return execution.u32Numbers( outputBuffer );
  } );
};

// Single radix sorts (no grain, just workgroup)
{
  const workgroupSize = 256;
  const inputSize = workgroupSize - 27;

  const numbers = _.range( 0, inputSize ).map( () => random.nextIntBetween( 0, 0xffffff ) );
  // const numbers = [ 1364798, 10578516, 13737492, 12024015, 6833872, 1085794, 11654541, 10021432, 12380875, 13992316, 10975796, 7346702, 5537158, 1332951, 12063124, 1168340, 11226432, 11351003, 2658100, 8013178, 2935064, 4986846, 3655186, 9195201, 4752512, 2991050, 184691, 14302236, 13507149, 6783564, 11474160, 14031909, 5493767, 1416634, 6987188, 11531481, 2406390, 5115375, 2094553, 9423993, 6086038, 13384702, 182017, 4169775, 11980008, 6707413, 8584240, 8280376, 14451307, 1933745, 8175693, 9975559, 5262379, 7958169, 9120440, 13747926, 5744633, 5917187, 4965169, 8737585, 2974432, 14230926, 14456879, 6214823, 5596467, 12766047, 14564176, 10991757, 14116332, 12441721, 12070690, 15825806, 11651175, 13458483, 11608000, 15438313, 13118163, 5446140, 3660418, 11746788, 7340727, 7114397, 16239338, 2349902, 12217420, 15981017, 13375611, 9995336, 16658243, 9133712, 4732204, 16144371, 7339899, 4919670, 1896281, 10742962, 7671583, 3865637, 9402432, 8157912, 15808196, 3009630, 12779673, 6270909, 7614192, 16265779, 16525844, 12767534, 820730, 15302437, 4796180, 7435716, 6507160, 2729961, 14587416, 8865717, 10710001, 6731445, 4011240, 1260218, 14366678, 10927967, 12337799, 14667591, 10442499, 13625584, 3511385, 5341608, 1113391, 2657725, 3257943, 3424633, 10421712, 2130189, 7909189, 9613348, 2273494, 221599, 4366598, 7734762, 5197867, 15877025, 4359548, 5444363, 9405434, 5569078, 7299554, 7389264, 14815290, 9084891, 13265744, 11124531, 3828772, 1962979, 13670617, 15007973, 10461364, 14508678, 5602579, 15091981, 8106688, 4098433, 1824647, 9724572, 5936634, 1993189, 14598925, 4829241, 15560534, 2361968, 1507773, 11099474, 13402589, 15119769, 11396042, 3184134, 8425672, 6897428, 4116714, 2501611, 6593567, 16401674, 3117816, 3819496, 6619055, 14873598, 14707469, 9310676, 6205182, 4522448, 6820920, 8877544, 15935190, 13538118, 16608867, 2095019, 12075575, 8882342, 11901644, 5349467, 7503746, 13401532, 7765114, 10723323, 10027836, 7067600, 3135197, 8206987, 2949001, 7089516, 15855764, 7503, 9588033, 9821242, 3202839, 12873462, 2515022, 493784, 728998, 4351782, 13715672, 750997, 10985591, 2532275, 7092819, 5210656, 13937186, 10988941, 11785752 ];

  asyncTestWithDevice( 'u32_workgroup_radix_sort', async ( device, deviceContext ) => {

    const shader = OldComputeShader.fromSource(
      device, 'u32_workgroup_radix_sort', wgsl_u32_workgroup_radix_sort, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        inputSize: inputSize
      }
    );

    return testSort( numbers, runU32MapShader( deviceContext, shader ) );
  } );

  asyncTestWithDevice( 'u32_compact_workgroup_radix_sort', async ( device, deviceContext ) => {

    const shader = OldComputeShader.fromSource(
      device, 'u32_compact_workgroup_radix_sort', wgsl_u32_compact_workgroup_radix_sort, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        inputSize: inputSize
      }
    );

    return testSort( numbers, runU32MapShader( deviceContext, shader ) );
  } );
}

// Single radix sorts with grain
{
  const workgroupSize = 256;
  const grainSize = 4;
  const inputSize = workgroupSize * ( grainSize - 1 ) - 27;

  const numbers = _.range( 0, inputSize ).map( () => random.nextIntBetween( 0, 0xffffff ) );
  // const numbers = [ 1364798, 10578516, 13737492, 12024015, 6833872, 1085794, 11654541, 10021432, 12380875, 13992316, 10975796, 7346702, 5537158, 1332951, 12063124, 1168340, 11226432, 11351003, 2658100, 8013178, 2935064, 4986846, 3655186, 9195201, 4752512, 2991050, 184691, 14302236, 13507149, 6783564, 11474160, 14031909, 5493767, 1416634, 6987188, 11531481, 2406390, 5115375, 2094553, 9423993, 6086038, 13384702, 182017, 4169775, 11980008, 6707413, 8584240, 8280376, 14451307, 1933745, 8175693, 9975559, 5262379, 7958169, 9120440, 13747926, 5744633, 5917187, 4965169, 8737585, 2974432, 14230926, 14456879, 6214823, 5596467, 12766047, 14564176, 10991757, 14116332, 12441721, 12070690, 15825806, 11651175, 13458483, 11608000, 15438313, 13118163, 5446140, 3660418, 11746788, 7340727, 7114397, 16239338, 2349902, 12217420, 15981017, 13375611, 9995336, 16658243, 9133712, 4732204, 16144371, 7339899, 4919670, 1896281, 10742962, 7671583, 3865637, 9402432, 8157912, 15808196, 3009630, 12779673, 6270909, 7614192, 16265779, 16525844, 12767534, 820730, 15302437, 4796180, 7435716, 6507160, 2729961, 14587416, 8865717, 10710001, 6731445, 4011240, 1260218, 14366678, 10927967, 12337799, 14667591, 10442499, 13625584, 3511385, 5341608, 1113391, 2657725, 3257943, 3424633, 10421712, 2130189, 7909189, 9613348, 2273494, 221599, 4366598, 7734762, 5197867, 15877025, 4359548, 5444363, 9405434, 5569078, 7299554, 7389264, 14815290, 9084891, 13265744, 11124531, 3828772, 1962979, 13670617, 15007973, 10461364, 14508678, 5602579, 15091981, 8106688, 4098433, 1824647, 9724572, 5936634, 1993189, 14598925, 4829241, 15560534, 2361968, 1507773, 11099474, 13402589, 15119769, 11396042, 3184134, 8425672, 6897428, 4116714, 2501611, 6593567, 16401674, 3117816, 3819496, 6619055, 14873598, 14707469, 9310676, 6205182, 4522448, 6820920, 8877544, 15935190, 13538118, 16608867, 2095019, 12075575, 8882342, 11901644, 5349467, 7503746, 13401532, 7765114, 10723323, 10027836, 7067600, 3135197, 8206987, 2949001, 7089516, 15855764, 7503, 9588033, 9821242, 3202839, 12873462, 2515022, 493784, 728998, 4351782, 13715672, 750997, 10985591, 2532275, 7092819, 5210656, 13937186, 10988941, 11785752 ];

  asyncTestWithDevice( 'u32_single_radix_sort early', async ( device, deviceContext ) => {

    const shader = OldComputeShader.fromSource(
      device, 'u32_single_radix_sort early', wgsl_u32_single_radix_sort, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        inputSize: inputSize,
        earlyLoad: true
      }
    );

    return testSort( numbers, runU32MapShader( deviceContext, shader ) );
  } );

  asyncTestWithDevice( 'u32_single_radix_sort late', async ( device, deviceContext ) => {

    const shader = OldComputeShader.fromSource(
      device, 'u32_single_radix_sort late', wgsl_u32_single_radix_sort, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        inputSize: inputSize,
        earlyLoad: false
      }
    );

    return testSort( numbers, runU32MapShader( deviceContext, shader ) );
  } );

  // TODO: profile these differences(!)
  asyncTestWithDevice( 'u32_compact_single_radix_sort early', async ( device, deviceContext ) => {

    const shader = OldComputeShader.fromSource(
      device, 'u32_compact_single_radix_sort early', wgsl_u32_compact_single_radix_sort, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        inputSize: inputSize,
        bitsPerInnerPass: 2,
        bitVectorSize: 2,
        earlyLoad: true
      }
    );

    return testSort( numbers, runU32MapShader( deviceContext, shader ) );
  } );

  asyncTestWithDevice( 'u32_compact_single_radix_sort late', async ( device, deviceContext ) => {

    const shader = OldComputeShader.fromSource(
      device, 'u32_compact_single_radix_sort late', wgsl_u32_compact_single_radix_sort, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        inputSize: inputSize,
        bitsPerInnerPass: 2,
        bitVectorSize: 2,
        earlyLoad: false
      }
    );

    return testSort( numbers, runU32MapShader( deviceContext, shader ) );
  } );

  asyncTestWithDevice( 'u32_compact_single_radix_sort late 3-bit vec3u', async ( device, deviceContext ) => {

    const shader = OldComputeShader.fromSource(
      device, 'u32_compact_single_radix_sort late 3-bit vec3u', wgsl_u32_compact_single_radix_sort, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        inputSize: inputSize,
        bitsPerInnerPass: 3,
        bitVectorSize: 3,
        earlyLoad: false
      }
    );

    return testSort( numbers, runU32MapShader( deviceContext, shader ) );
  } );
}

const test_u32_radix_histogram = (
  workgroupSize: number,
  grainSize: number,
  inputSize: number,
  numBins: number
) => {
  const name = `u32_radix_histogram wg:${workgroupSize} g:${grainSize} i:${inputSize} bins:${numBins}`;

  asyncTestWithDevice( name, async ( device, deviceContext ) => {
    const dispatchSize = Math.ceil( inputSize / ( workgroupSize * grainSize ) );
    const tableSize = numBins * dispatchSize;

    // Fill all our workgroups with numbers, even if we only use some
    const numbers = _.range( 0, dispatchSize * workgroupSize * grainSize ).map( () => random.nextIntBetween( 0, numBins - 1 ) );

    const shader = OldComputeShader.fromSource(
      device, name, wgsl_u32_radix_histogram, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        inputSize: inputSize,
        numBins: numBins
      }
    );

    const outputArray = await deviceContext.executeSingle( async ( encoder, execution ) => {
      const inputBuffer = execution.createU32Buffer( numbers );
      const outputBuffer = execution.createBuffer( 4 * tableSize );

      shader.dispatch( encoder, [
        inputBuffer, outputBuffer
      ], dispatchSize );

      return execution.u32Numbers( outputBuffer );
    } );

    const expectedArray = _.range( 0, tableSize ).map( () => 0 );
    for ( let i = 0; i < inputSize; i++ ) {
      const bin = numbers[ i ];
      const workgroup = Math.floor( i / ( workgroupSize * grainSize ) );
      const index = bin * dispatchSize + workgroup;
      expectedArray[ index ]++;
    }

    for ( let bin = 0; bin < numBins; bin++ ) {
      for ( let workgroup = 0; workgroup < dispatchSize; workgroup++ ) {
        const actualValue = outputArray[ bin * dispatchSize + workgroup ];
        const expectedValue = expectedArray[ bin * dispatchSize + workgroup ];

        if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {

          console.log( `failed on dispatch ${workgroup}, bin ${bin}` );

          console.log( 'expected' );
          console.log( _.chunk( expectedArray, 16 ) );

          console.log( 'actual' );
          console.log( _.chunk( outputArray, 16 ) );

          return `expected ${expectedValue}, actual ${actualValue}`;
        }
      }
    }

    return null;
  } );
};

test_u32_radix_histogram( 256, 8, 256 * 8 * 8 - 256 * 2 - 27, 256 );
test_u32_radix_histogram( 64, 4, 256 * 64 * 7, 512 );
test_u32_radix_histogram( 64, 4, 256 * 64 * 27, 512 );

type ReducedLoadOptions = {
  workgroupSize: number;
  grainSize: number;
  valueType: string;
  useLoadExpression: boolean;
  identity: string;
  length: string | null;
  combineExpression: null | ( ( aExpr: string, bExpr: string ) => string );
  combineStatements: null | ( ( varName: string, aExpr: string, bExpr: string ) => string );
  inputOrder: null | 'blocked' | 'striped';
  inputAccessOrder: 'blocked' | 'striped';
  factorOutSubexpressions: boolean;
  nestSubexpressions: boolean;

  actualLength: number;
  inputData: ArrayBuffer;
  bytesPerItem: number;
  expectedValue: ArrayBuffer;
};
const test_load_reduced = ( subname: string, options: ReducedLoadOptions ) => {
  const name = `load_reduced ${subname}`;
  asyncTestWithDevice( name, async ( device, deviceContext ) => {
    const dispatchSize = Math.ceil( options.actualLength / ( options.workgroupSize * options.grainSize ) );

    const shader = OldComputeShader.fromSource(
      device, name, wgsl_example_load_reduced, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], options
    );

    const actualValue = await deviceContext.executeSingle( async ( encoder, execution ) => {
      const inputBuffer = execution.createBuffer( options.inputData.byteLength );
      device.queue.writeBuffer( inputBuffer, 0, options.inputData );

      const outputBuffer = execution.createBuffer( options.bytesPerItem * options.workgroupSize * dispatchSize );

      shader.dispatch( encoder, [
        inputBuffer, outputBuffer
      ], dispatchSize );

      return execution.arrayBuffer( outputBuffer );
    } );

    const expectedArray = [ ...new Uint32Array( options.expectedValue ) ];
    const actualArray = [ ...new Uint32Array( actualValue ) ].slice( 0, expectedArray.length );

    for ( let i = 0; i < expectedArray.length; i++ ) {
      if ( expectedArray[ i ] !== actualArray[ i ] ) {
        console.log( 'expected' );
        console.log( _.chunk( expectedArray, 16 ) );

        console.log( 'actual' );
        console.log( _.chunk( actualArray, 16 ) );

        return `expected ${expectedArray[ i ]}, actual ${actualArray[ i ]}`;
      }
    }

    return null;
  } );
};

[ false, true ].forEach( useCombineExpression => {
  [ false, true ].forEach( useLoadExpression => {
    [ 'factored', 'not factored', 'nested' ].forEach( style => {
      if ( style === 'nested' && ( !useLoadExpression || !useCombineExpression ) ) {
        // Can't put nesting with statements
        return;
      }

      test_load_reduced( `u32_tiny_example load-${useLoadExpression ? 'expr' : 'statement'}, combine-${useCombineExpression ? 'expr' : 'statement'}, ${style}`, {
        workgroupSize: 4,
        grainSize: 2,
        valueType: 'u32',
        useLoadExpression: useLoadExpression,
        identity: '0u',
        combineExpression: useCombineExpression ? ( ( a, b ) => `${a} + ${b}` ) : null,
        combineStatements: useCombineExpression ? null : ( ( varName, a, b ) => `${varName} = ${a} + ${b};` ),
        inputOrder: 'blocked',
        inputAccessOrder: 'blocked',
        factorOutSubexpressions: style === 'factored',
        nestSubexpressions: style === 'nested',
        length: u32( 11 ),

        actualLength: 13,
        inputData: new Uint32Array( [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, /* cut */ 11, 12 ] ).buffer,
        bytesPerItem: 4,
        expectedValue: new Uint32Array( [ 1, 5, 9, 13, 17, 10 ] ).buffer
      } );

      test_load_reduced( `u32_tiny_example (no-length) load-${useLoadExpression ? 'expr' : 'statement'}, combine-${useCombineExpression ? 'expr' : 'statement'}, ${style}`, {
        workgroupSize: 4,
        grainSize: 2,
        valueType: 'u32',
        useLoadExpression: useLoadExpression,
        identity: '0u',
        combineExpression: useCombineExpression ? ( ( a, b ) => `${a} + ${b}` ) : null,
        combineStatements: useCombineExpression ? null : ( ( varName, a, b ) => `${varName} = ${a} + ${b};` ),
        inputOrder: 'blocked',
        inputAccessOrder: 'blocked',
        factorOutSubexpressions: style === 'factored',
        nestSubexpressions: style === 'nested',
        length: null,

        actualLength: 16,
        inputData: new Uint32Array( [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 ] ).buffer,
        bytesPerItem: 4,
        expectedValue: new Uint32Array( [ 1, 5, 9, 13, 17, 21, 25, 29 ] ).buffer
      } );

      test_load_reduced( `u32_tiny_example (striped access) load-${useLoadExpression ? 'expr' : 'statement'}, combine-${useCombineExpression ? 'expr' : 'statement'}, ${style}`, {
        workgroupSize: 4,
        grainSize: 2,
        valueType: 'u32',
        useLoadExpression: useLoadExpression,
        identity: '0u',
        combineExpression: useCombineExpression ? ( ( a, b ) => `${a} + ${b}` ) : null,
        combineStatements: useCombineExpression ? null : ( ( varName, a, b ) => `${varName} = ${a} + ${b};` ),
        inputOrder: 'blocked',
        inputAccessOrder: 'striped',
        factorOutSubexpressions: style === 'factored',
        nestSubexpressions: style === 'nested',
        length: u32( 11 ),

        actualLength: 13,
        inputData: new Uint32Array( [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, /* cut */ 11, 12 ] ).buffer,
        bytesPerItem: 4,
        expectedValue: new Uint32Array( [ 4, 6, 8, 10, 8, 9, 10 ] ).buffer
      } );

      test_load_reduced( `u32_tiny_example (striped access, no-length) load-${useLoadExpression ? 'expr' : 'statement'}, combine-${useCombineExpression ? 'expr' : 'statement'}, ${style}`, {
        workgroupSize: 4,
        grainSize: 2,
        valueType: 'u32',
        useLoadExpression: useLoadExpression,
        identity: '0u',
        combineExpression: useCombineExpression ? ( ( a, b ) => `${a} + ${b}` ) : null,
        combineStatements: useCombineExpression ? null : ( ( varName, a, b ) => `${varName} = ${a} + ${b};` ),
        inputOrder: 'blocked',
        inputAccessOrder: 'striped',
        factorOutSubexpressions: style === 'factored',
        nestSubexpressions: style === 'nested',
        length: null,

        actualLength: 16,
        inputData: new Uint32Array( [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 ] ).buffer,
        bytesPerItem: 4,
        expectedValue: new Uint32Array( [ 4, 6, 8, 10, 20, 22, 24, 26 ] ).buffer
      } );

      test_load_reduced( `u32_tiny_example (striped access, striped-order!!) load-${useLoadExpression ? 'expr' : 'statement'}, combine-${useCombineExpression ? 'expr' : 'statement'}, ${style}`, {
        workgroupSize: 4,
        grainSize: 2,
        valueType: 'u32',
        useLoadExpression: useLoadExpression,
        identity: '0u',
        combineExpression: useCombineExpression ? ( ( a, b ) => `${a} + ${b}` ) : null,
        combineStatements: useCombineExpression ? null : ( ( varName, a, b ) => `${varName} = ${a} + ${b};` ),
        inputOrder: 'striped',
        inputAccessOrder: 'striped',
        factorOutSubexpressions: style === 'factored',
        nestSubexpressions: style === 'nested',
        length: u32( 11 ),

        actualLength: 16,
        inputData: new Uint32Array( [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 ] ).buffer,
        bytesPerItem: 4,
        expectedValue: new Uint32Array( [ 4, 6, 8, 10, 20, 9, 0, 0 ] ).buffer
      } );

      const bic2 = ( a: Vector2, b: Vector2 ) => a.plus( b ).minusScalar( Math.min( a.y, b.x ) );
      const bic2Array = ( a: number, b: number, c: number, d: number ) => {
        const result = bic2( new Vector2( a, b ), new Vector2( c, d ) );
        return [ result.x, result.y ];
      };
      test_load_reduced( `non-commutative bicyclic semigroup load-${useLoadExpression ? 'expr' : 'statement'}, combine-${useCombineExpression ? 'expr' : 'statement'}, ${style}`, {
        workgroupSize: 4,
        grainSize: 2,
        valueType: 'vec2u',
        useLoadExpression: useLoadExpression,
        identity: 'vec2( 0u )',
        combineExpression: useCombineExpression ? ( ( a, b ) => `( ${a} + ${b} - min( ${a}.y, ${b}.x ) )` ) : null,
        combineStatements: useCombineExpression ? null : ( ( varName, a, b ) => `
          let fa = ${a};
          let fb = ${b};
          ${varName} = fa + fb - min( fa.y, fb.x );
        ` ),
        inputOrder: 'blocked',
        inputAccessOrder: 'blocked',
        factorOutSubexpressions: style === 'factored',
        nestSubexpressions: style === 'nested',
        length: u32( 11 ),

        actualLength: 16,
        inputData: new Uint32Array( [
          0, 5,
          2, 3,
          4, 5,
          1, 1,
          2, 7,
          8, 3,
          6, 2,
          9, 1,
          3, 8,
          7, 4,
          9, 1,
          // cut
          12, 20,
          4, 15,
          5, 1,
          9, 17,
          20, 21
        ] ).buffer,
        bytesPerItem: 8,
        expectedValue: new Uint32Array( [
          ...bic2Array( 0, 5, 2, 3 ),
          ...bic2Array( 4, 5, 1, 1 ),
          ...bic2Array( 2, 7, 8, 3 ),
          ...bic2Array( 6, 2, 9, 1 ),
          ...bic2Array( 3, 8, 7, 4 ),
          ...bic2Array( 9, 1, 0, 0 )
        ] ).buffer
      } );

      const bic3 = ( a: Vector2, b: Vector2, c: Vector2 ) => bic2( a, bic2( b, c ) );
      const bic3Array = ( a: number, b: number, c: number, d: number, e: number, f: number ) => {
        const result = bic3( new Vector2( a, b ), new Vector2( c, d ), new Vector2( e, f ) );
        return [ result.x, result.y ];
      };

      test_load_reduced( `non-commutative bicyclic semigroup 3-grain load-${useLoadExpression ? 'expr' : 'statement'}, combine-${useCombineExpression ? 'expr' : 'statement'}, ${style}`, {
        workgroupSize: 4,
        grainSize: 3,
        valueType: 'vec2u',
        useLoadExpression: useLoadExpression,
        identity: 'vec2( 0u )',
        combineExpression: useCombineExpression ? ( ( a, b ) => `( ${a} + ${b} - min( ${a}.y, ${b}.x ) )` ) : null,
        combineStatements: useCombineExpression ? null : ( ( varName, a, b ) => `
          let fa = ${a};
          let fb = ${b};
          ${varName} = fa + fb - min( fa.y, fb.x );
        ` ),
        inputOrder: 'blocked',
        inputAccessOrder: 'blocked',
        factorOutSubexpressions: style === 'factored',
        nestSubexpressions: style === 'nested',
        length: u32( 11 ),

        actualLength: 16,
        inputData: new Uint32Array( [
          0, 5,
          2, 3,
          4, 5,
          1, 1,
          2, 7,
          8, 3,
          6, 2,
          9, 1,
          3, 8,
          7, 4,
          9, 1,
          // cut
          12, 20,
          4, 15,
          5, 1,
          9, 17,
          20, 21
        ] ).buffer,
        bytesPerItem: 8,
        expectedValue: new Uint32Array( [
          ...bic3Array( 0, 5, 2, 3, 4, 5 ),
          ...bic3Array( 1, 1, 2, 7, 8, 3 ),
          ...bic3Array( 6, 2, 9, 1, 3, 8 ),
          ...bic3Array( 7, 4, 9, 1, 0, 0 )
        ] ).buffer
      } );

      test_load_reduced( `non-commutative bicyclic semigroup 3-grain no-length load-${useLoadExpression ? 'expr' : 'statement'}, combine-${useCombineExpression ? 'expr' : 'statement'}, ${style}`, {
        workgroupSize: 4,
        grainSize: 3,
        valueType: 'vec2u',
        useLoadExpression: useLoadExpression,
        identity: 'vec2( 0u )',
        combineExpression: useCombineExpression ? ( ( a, b ) => `( ${a} + ${b} - min( ${a}.y, ${b}.x ) )` ) : null,
        combineStatements: useCombineExpression ? null : ( ( varName, a, b ) => `
          let fa = ${a};
          let fb = ${b};
          ${varName} = fa + fb - min( fa.y, fb.x );
        ` ),
        inputOrder: 'blocked',
        inputAccessOrder: 'blocked',
        factorOutSubexpressions: style === 'factored',
        nestSubexpressions: style === 'nested',
        length: null,

        actualLength: 12,
        inputData: new Uint32Array( [
          0, 5,
          2, 3,
          4, 5,
          1, 1,
          2, 7,
          8, 3,
          6, 2,
          9, 1,
          3, 8,
          7, 4,
          9, 1,
          12, 20
        ] ).buffer,
        bytesPerItem: 8,
        expectedValue: new Uint32Array( [
          ...bic3Array( 0, 5, 2, 3, 4, 5 ),
          ...bic3Array( 1, 1, 2, 7, 8, 3 ),
          ...bic3Array( 6, 2, 9, 1, 3, 8 ),
          ...bic3Array( 7, 4, 9, 1, 12, 20 )
        ] ).buffer
      } );
    } );
  } );
} );

const reorderTest = ( name: string, source: OldDualSnippetSource, indexMap: ( index: number, workgroupSize: number, grainSize: number ) => number ) => {
  asyncTestWithDevice( name, async ( device, deviceContext ) => {
    const workgroupSize = 256;
    const grainSize = 8;
    const dispatchSize = 5;

    const quantity = dispatchSize * workgroupSize * grainSize;

    const numbers = _.range( 0, quantity ).map( () => random.nextIntBetween( 0, 0xffff ) );

    const shader = OldComputeShader.fromSource(
      device, name, source, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize
      }
    );

    const outputNumbers = await deviceContext.executeSingle( async ( encoder, execution ) => {
      const inputBuffer = execution.createU32Buffer( numbers );
      const outputBuffer = execution.createBuffer( 4 * quantity );

      shader.dispatch( encoder, [
        inputBuffer, outputBuffer
      ], dispatchSize );

      return execution.u32Numbers( outputBuffer );
    } );

    for ( let i = 0; i < quantity; i++ ) {
      if ( numbers[ i ] !== outputNumbers[ indexMap( i, workgroupSize, grainSize ) ] ) {
        console.log( 'expected' );
        console.log( _.chunk( numbers, 16 ) );

        console.log( 'actual' );
        console.log( _.chunk( outputNumbers, 16 ) );

        return `expected ${numbers[ i ]}, actual ${outputNumbers[ indexMap( i, workgroupSize, grainSize ) ]}`;
      }
    }

    return null;
  } );
};

reorderTest( 'u32_from_striped', wgsl_u32_from_striped, ByteEncoder.fromStripedIndex );
reorderTest( 'u32_to_striped', wgsl_u32_to_striped, ByteEncoder.toStripedIndex );
reorderTest(
  'u32_flip_convergent',
  wgsl_u32_flip_convergent,
  ( index, workgroupSize, grainSize ) => ByteEncoder.getConvergentIndex( index, workgroupSize * grainSize )
);
