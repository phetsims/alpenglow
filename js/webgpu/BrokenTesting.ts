// Copyright 2023, University of Colorado Boulder

/**
 * For testing potentially buggy cases
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, ComputeShader, DeviceContext, wgsl_i32_merge } from '../imports.js';
import Random from '../../../dot/js/Random.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

export default class BrokenTesting {
  public static async test(): Promise<void> {
    const device = await DeviceContext.getDevice();
    if ( !device ) {
      return;
    }

    const workgroupSize = 64;
    const grainSize = 8;
    const a = _.range( 0, 1300 ).map( () => random.nextIntBetween( 0, 2000 ) ).sort( ( a, b ) => a - b );
    const b = _.range( 0, 1000 ).map( () => random.nextIntBetween( 0, 2000 ) ).sort( ( a, b ) => a - b );

    const length = a.length + b.length;
    const dispatchSize = Math.ceil( length / ( workgroupSize * grainSize ) );

    const context = new DeviceContext( device );

    const shader = ComputeShader.fromSource(
      device, 'i32_merge', wgsl_i32_merge, [
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

    const step = async () => {
      window.requestAnimationFrame( step );

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

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const actualValue = [ ...outputArray ].slice( 0, length );

      // console.log( actualValue );
    };
    await step();
  }
}

alpenglow.register( 'BrokenTesting', BrokenTesting );
