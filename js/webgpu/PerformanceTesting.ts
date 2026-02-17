// Copyright 2023-2025, University of Colorado Boulder

/**
 * For testing overlapping (parallel) execution of shader stages that don't write to the same memory.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../alpenglow.js';
import { DeviceContext } from './compute/DeviceContext.js';
import { getArrayType, U32Order } from './compute/ConcreteType.js';
import { BufferArraySlot } from './compute/BufferArraySlot.js';
import { RadixSortModule } from './modules/gpu/RadixSortModule.js';
import { u32S } from './wgsl/WGSLString.js';
import { Routine } from './compute/Routine.js';
import { Procedure } from './compute/Procedure.js';
import { toFixed } from '../../../dot/js/util/toFixed.js';

export class PerformanceTesting {
  public static async loopRadixSortTest(
    combineStrategy: boolean,
    separateComputePasses: boolean
  ): Promise<void> {
    const countPerFrame = 1000;

    const inputSize = 4000;
    // const inputSize = workgroupSize * workgroupSize * ( 6 ) - 27 * 301;
    // const inputSize = workgroupSize * workgroupSize * ( workgroupSize - 3 ) - 27 * 301;
    // eslint-disable-next-line phet/bad-sim-text
    const uintNumbers = new Uint32Array( _.range( 0, inputSize ).map( () => Math.floor( Math.random() * 1000000 ) ) );

    const device = ( await DeviceContext.getDevice() )!;
    const deviceContext = new DeviceContext( device );

    const order = U32Order;
    const size = inputSize;
    const maximumSize = inputSize + 100;

    const inputSlot = new BufferArraySlot( getArrayType( order.type, maximumSize ) );
    const outputSlot = new BufferArraySlot( getArrayType( order.type, maximumSize ) );

    const radixSortModule = new RadixSortModule( {
      input: inputSlot,
      output: outputSlot,
      name: 'performance test',

      order: order,
      totalBits: 32,

      radixWorkgroupSize: 64,
      radixGrainSize: 4,
      scanWorkgroupSize: 64,
      scanGrainSize: 4,

      lengthExpression: u32S( size ),

      bitsPerPass: 2, // TODO: try 8 once we are doing more
      bitsPerInnerPass: 2,
      earlyLoad: false,
      scanModuleOptions: {
        areScannedReductionsExclusive: false
      }
    } );

    const routine = await Routine.create(
      deviceContext,
      radixSortModule,
      [ inputSlot, outputSlot ],
      combineStrategy ? Routine.COMBINE_ALL_LAYOUT_STRATEGY : Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      async ( context, execute, input: number[] ) => {
        context.setTypedBufferValue( inputSlot, input );

        for ( let i = 0; i < countPerFrame; i++ ) {
          execute( context, input.length );
        }
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    let startTime: DOMHighResTimeStamp | null = null;
    let countElapsed = 0;
    const elapsedTimes: number[] = [];

    const step = async () => {
      requestAnimationFrame( step );

      if ( startTime === null ) {
        startTime = performance.now();
      }

      countElapsed++;

      if ( countElapsed % 500 === 0 ) {
        const now = performance.now();
        const elapsed = now - startTime;
        startTime = now;
        elapsedTimes.push( elapsed );
        console.log( toFixed( elapsed, 0 ), elapsedTimes.length > 1 ? toFixed( _.sum( elapsedTimes.slice( 1 ) ) / elapsedTimes.slice( 1 ).length, 0 ) : 0 );
      }

      // TODO: maybe avoid the await on the first frame?

      // TODO: accept typed arrays and get things working more efficiently!
      await procedure.standaloneExecute( deviceContext, [ ...uintNumbers ], {
        procedureExecuteOptions: {
          separateComputePasses: separateComputePasses
        }
      } );
    };
    await step();
  }
}

alpenglow.register( 'PerformanceTesting', PerformanceTesting );