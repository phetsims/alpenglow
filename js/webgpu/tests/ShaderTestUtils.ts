// Copyright 2023, University of Colorado Boulder

/**
 * Utilities for testing shaders
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ConcreteType, DeviceContext } from '../../imports.js';

export const shaderTestDevicePromise: Promise<GPUDevice | null> = ( async () => {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    return ( await adapter?.requestDevice() ) || null;
  }
  catch( e ) {
    return null;
  }
} )();

export const asyncTestWithDevice = ( name: string, test: ( device: GPUDevice, deviceContext: DeviceContext ) => Promise<string | null> ): void => {
  QUnit.test( name, async assert => {
    const done = assert.async();

    const device = await shaderTestDevicePromise;

    if ( !device ) {
      assert.expect( 0 );
    }
    else {
      const result = await test( device, new DeviceContext( device ) );
      assert.ok( result === null, result || '' );
    }

    done();
  } );
};

export const asyncTestWithDeviceContext = ( name: string, test: ( deviceContext: DeviceContext ) => Promise<string | null> ): void => {
  asyncTestWithDevice( name, ( device, deviceContext ) => test( deviceContext ) );
};

export const compareArrays = <T>( type: ConcreteType<T>, inputValues: T[], expectedValues: T[], actualValues: T[] ): string | null => {
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
