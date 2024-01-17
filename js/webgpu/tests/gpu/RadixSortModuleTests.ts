// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { asyncTestWithDevice, BufferArraySlot, compareArrays, getArrayType, getMaxRadixBitsPerInnerPass, getRadixBitVectorSize, Order, Procedure, RadixSortModule, RadixSortModuleOptions, Routine, u32, U32Order, U32ReverseOrder, Vec2uLexicographicalOrder } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import IntentionalAny from '../../../../../phet-core/js/types/IntentionalAny.js';

QUnit.module( 'RadixSortModuleTests' );

type RadixSortModuleTestOptions<T> = {
  order: Order<T>; // extended, so we can do easy comparison here

  inputSize: number;
  maximumSize: number;
  inPlace: boolean;
  fullSize: boolean;
  bitsPerInnerPass: number;
  scanModuleOptions: {
    areScannedReductionsExclusive: boolean;
  };
} & StrictOmit<RadixSortModuleOptions<T>, 'input' | 'output' | 'lengthExpression'>;

const testRadixSortModule = <T>( options: RadixSortModuleTestOptions<T> ) => {

  const innerBitVectorSize = getRadixBitVectorSize( options.radixWorkgroupSize, options.radixGrainSize, options.bitsPerInnerPass );

  const name = `${options.order.name} radix sort (#:${options.inputSize} radix:${options.radixWorkgroupSize}x${options.radixGrainSize} scan:${options.scanWorkgroupSize}x${options.scanGrainSize} bits:${options.bitsPerPass}, bitQ:${options.bitsPerInnerPass} bitVec:${innerBitVectorSize} full:${options.fullSize} early:${options.earlyLoad} reducEx:${options.scanModuleOptions.areScannedReductionsExclusive})`;

  asyncTestWithDevice( name, async ( device, deviceContext ) => {

    const inputSlot = new BufferArraySlot( getArrayType( options.order.type, options.maximumSize ) );
    const outputSlot = options.inPlace ? inputSlot : new BufferArraySlot( getArrayType( options.order.type, options.maximumSize ) );

    const radixSortModule = new RadixSortModule( combineOptions<RadixSortModuleOptions<T>>( {
      input: inputSlot,
      output: outputSlot,
      lengthExpression: u32( options.inputSize ),
      name: name
    }, options ) );

    // TODO: can we factor out some things here, like the execute wrapper?
    const routine = await Routine.create(
      deviceContext,
      radixSortModule,
      [ inputSlot, outputSlot ],
      Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      ( context, execute, input: T[] ) => {
        context.setTypedBufferValue( inputSlot, input );

        execute( context, input.length );

        return context.getTypedBufferValue( outputSlot );
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    const inputValues = _.range( 0, options.inputSize ).map( () => options.order.type.generateRandom( options.fullSize ) );

    const expectedValues: T[] = inputValues.slice().sort( options.order.compare );
    const actualValues = await procedure.standaloneExecute( deviceContext, inputValues );

    procedure.dispose();

    return compareArrays( options.order.type, inputValues, expectedValues, actualValues );
  } );
};

// TODO: for less shader compilation, get a way where we're not compiling a shader for each radix pass
[ false, true ].forEach( fullSize => {
  ( [
    { workgroupSize: 8, grainSize: 4 },
    { workgroupSize: 64, grainSize: 4 }
  ] as const ).forEach( ( { workgroupSize, grainSize } ) => {

    const maxBitsPerInnerPass = getMaxRadixBitsPerInnerPass( workgroupSize, grainSize );

    [ maxBitsPerInnerPass, 2 ].filter( bits => bits <= maxBitsPerInnerPass ).forEach( bitsPerInnerPass => {

      // TODO: how to handle memory size limits?
      [ 4, 8 ].forEach( bitsPerPass => {
        [ false, true ].forEach( isReductionExclusive => {
          [ false, true ].forEach( inPlace => {
            // Strategically reduce the number of tests we are running
            const nonStandardCount =
              ( workgroupSize === 64 ? 0 : 1 ) +
              ( fullSize ? 0 : 1 ) +
              ( bitsPerPass === 8 ? 0 : 1 ) +
              ( isReductionExclusive ? 0 : 1 ) +
              ( !inPlace ? 0 : 1 );
            if ( nonStandardCount > 1 ) {
              return;
            }

            const maxInputSize = Math.min(
              ( workgroupSize * grainSize ) * workgroupSize * grainSize * 2,
              RadixSortModule.getMaximumElementQuantity( workgroupSize, grainSize, workgroupSize, grainSize, bitsPerPass )
            );

            // TODO: separate workgroup sizes for the scan and the rest(!)
            const commonOptions: StrictOmit<RadixSortModuleTestOptions<IntentionalAny>, 'order' | 'totalBits'> = {
              radixWorkgroupSize: workgroupSize,
              radixGrainSize: grainSize,
              scanWorkgroupSize: workgroupSize,
              scanGrainSize: grainSize,
              bitsPerPass: bitsPerPass,
              bitsPerInnerPass: bitsPerInnerPass,
              fullSize: fullSize,
              maximumSize: maxInputSize,
              earlyLoad: false,
              inPlace: inPlace,
              scanModuleOptions: {
                areScannedReductionsExclusive: isReductionExclusive
              },
              inputSize: Math.min( maxInputSize, ( workgroupSize * grainSize ) * workgroupSize * grainSize * 2 ) - 27
            } as const;

            testRadixSortModule( combineOptions<RadixSortModuleTestOptions<number>>( {
              order: U32Order,
              totalBits: 32
            }, commonOptions ) );

            testRadixSortModule( combineOptions<RadixSortModuleTestOptions<number>>( {
              order: U32ReverseOrder,
              totalBits: 32
            }, commonOptions ) );

            testRadixSortModule( combineOptions<RadixSortModuleTestOptions<Vector2>>( {
              order: Vec2uLexicographicalOrder,
              totalBits: 32 * 2
            }, commonOptions ) );
          } );
        } );
      } );
    } );
  } );
} );
