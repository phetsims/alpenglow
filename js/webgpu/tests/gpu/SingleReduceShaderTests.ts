// Copyright 2023, University of Colorado Boulder

/**
 * Tests for SingleReduceShader
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { asyncTestWithDeviceContext, BindingLocation, compareArrays, SingleReduceShader, SingleReduceShaderOptions, u32, U32Add, Vec2uBic } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import WithRequired from '../../../../../phet-core/js/types/WithRequired.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

QUnit.module( 'WGSL SingleReduceShader' );

type Options<T> = StrictOmit<WithRequired<SingleReduceShaderOptions<T>, 'binaryOp'>, 'workgroupSize' | 'grainSize' | 'log' | 'bindingLocations'>;

const testSingleReduceShader = <T>(
  options: Options<T>
) => {
  const binaryOp = options.binaryOp;
  const name = `${binaryOp.name} SingleReduceShader ${options.loadReducedOptions?.sequentialReduceStyle}`;
  asyncTestWithDeviceContext( name, async deviceContext => {
    const workgroupSize = 256;
    const grainSize = 8;
    const inputSize = workgroupSize * grainSize * 5 - 27;

    const shader = await SingleReduceShader.create<T>( deviceContext, name, combineOptions<SingleReduceShaderOptions<T>>( {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
        lengthExpression: u32( inputSize )
      }, options.loadReducedOptions ),
      log: false,
      bindingLocations: {
        // TODO: connect these up to our shader handling
        input: new BindingLocation( 0, 0 ),
        output: new BindingLocation( 0, 1 )
      }
    }, options ) );

    const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );

    const actualValues = await deviceContext.executeShader( shader, inputValues );
    const expectedValues = _.chunk( inputValues.slice( 0, inputSize ), workgroupSize * grainSize ).map( inputValuesForWorkgroup => {
      return inputValuesForWorkgroup.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity );
    } );

    return compareArrays( binaryOp.type, inputValues, expectedValues, actualValues );
  } );
};

( [ 'factored', 'unfactored', 'nested' ] as const ).forEach( sequentialReduceStyle => {
  testSingleReduceShader( {
    binaryOp: U32Add,
    loadReducedOptions: {
      sequentialReduceStyle: sequentialReduceStyle
    }
  } );

  testSingleReduceShader( {
    binaryOp: Vec2uBic,
    loadReducedOptions: {
      inputAccessOrder: 'blocked',
      sequentialReduceStyle: sequentialReduceStyle
    }
  } );

  // TODO: test more
} );

