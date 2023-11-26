// Copyright 2023, University of Colorado Boulder

/**
 * Tests for SingleReduceShader
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { asyncTestWithDeviceContext, compareArrays, SingleReduceShader, SingleReduceShaderOptions, u32, U32Add, Vec2uBic } from '../../../imports.js';
import PickRequired from '../../../../../phet-core/js/types/PickRequired.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';

QUnit.module( 'WGSL SingleReduceShader' );

const testSingleReduceShader = <T>(
  options: Partial<SingleReduceShaderOptions<T>> & PickRequired<SingleReduceShaderOptions<T>, 'binaryOp'>
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
      log: false
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

