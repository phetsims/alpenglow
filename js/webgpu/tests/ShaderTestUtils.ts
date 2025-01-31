// Copyright 2023-2025, University of Colorado Boulder

/**
 * Utilities for testing shaders
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';
import { alpenglow } from '../../alpenglow.js';
import { webgpu } from '../WebGPUAPI.js';
import { DeviceContext } from '../compute/DeviceContext.js';
import { ConcreteType } from '../compute/ConcreteType.js';

webgpu.enableRecording();

export const shaderTestDevicePromise: Promise<GPUDevice | null> = ( async () => {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    return ( await adapter?.requestDevice() ) || null;
  }
  catch( e ) {
    return null;
  }
} )();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
alpenglow.register( 'shaderTestDevicePromise', shaderTestDevicePromise );

export const asyncTestWithDevice = ( name: string, test: ( device: GPUDevice, deviceContext: DeviceContext ) => Promise<string | null> ): void => {
  QUnit.test( name, async assert => {
    const done = assert.async();

    const device = await shaderTestDevicePromise;

    if ( !device ) {
      assert.expect( 0 );
    }
    else {
      console.groupCollapsed( name );

      const list = webgpu.startRecording();
      const result = await test( device, new DeviceContext( device ) );
      webgpu.stopRecording( list );

      console.groupCollapsed( 'webgpu' );
      console.log( list.toJSClosure() );
      console.groupEnd();

      assert.ok( result === null, result || '' );

      console.groupEnd();
    }

    done();
  } );
};

alpenglow.register( 'asyncTestWithDevice', asyncTestWithDevice );

export const asyncTestWithDeviceContext = ( name: string, test: ( deviceContext: DeviceContext ) => Promise<string | null> ): void => {
  asyncTestWithDevice( name, ( device, deviceContext ) => test( deviceContext ) );
};

alpenglow.register( 'asyncTestWithDeviceContext', asyncTestWithDeviceContext );

export const compareArrays = <T>( type: ConcreteType<T>, inputValues: IntentionalAny, expectedValues: T[], actualValues: T[] ): string | null => {
  for ( let i = 0; i < expectedValues.length; i++ ) {
    const expected = expectedValues[ i ];
    const actual = actualValues[ i ];

    if ( !type.equals( expected, actual ) ) {
      console.log( 'input' );
      console.log( inputValues );

      console.log( 'expected' );
      console.log( expectedValues );

      console.log( 'actual' );
      console.log( actualValues );

      return `expected ${type.toDebugString( expected )}, actual ${type.toDebugString( actual )} at index ${i}`;
    }
  }

  return null;
};

alpenglow.register( 'compareArrays', compareArrays );