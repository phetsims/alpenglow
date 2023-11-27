// Copyright 2023, University of Colorado Boulder

/**
 * A three-level standalone scan.
 *
 * Four stages:
 *
 * 1. A level of reduction (takes the "upper" input data, and reduces it to a single value per workgroup, saved in reduces)
 * 2. Scan of the reduces (in place, but also outputs another level of reduces ("double reduces")).
 * 3. Scan of the double reduces (the entire "lower" data will fit within a single workgroup)
 * 4. Scan of the original data, where the relevant reduce and double-reduce is added to each workgroup's elements.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, ByteEncoder, ComputeShader, ComputeShaderSourceOptions, DeviceContext, ExecutableShader, Execution, u32, wgsl_main_reduce, wgsl_main_reduce_non_commutative, wgsl_main_scan, wgsl_main_scan_reduce, wgsl_main_scan_add_2 } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';

export type TripleReduceScanShaderOptions<T> = {

  // The type of the data for WGSL, e.g. 'f32'
  valueType: string;

  isCommutative: boolean;

  identityExpression: string;

  exclusive?: boolean;

  // One of these two "combine" options should be provided.
  combineExpression?: ( ( aExpression: string, bExpression: string ) => string ) | null;
  combineStatements?: ( ( varName: string, aExpression: string, bExpression: string ) => string ) | null;

  workgroupSize?: number;
  grainSize?: number;
  lengthExpression?: string | null; // if null, no range checks will be made

  // The actual ordering of the input data. TODO describe striping order
  inputOrder?: 'blocked' | 'striped'; // TODO: do we... stripe the output now? Is this... supported?

  // How we access the input data.
  inputAccessOrder?: 'blocked' | 'striped';

  factorOutSubexpressions?: boolean;
  nestSubexpressions?: boolean;

  // Whether our internal "reduces" data will be exclusive or inclusive (both are possible)
  isReductionExclusive?: boolean;

  // The number of bytes
  bytesPerElement: number;

  encodeElement: ( element: T, encoder: ByteEncoder ) => void;
  decodeElement: ( encoder: ByteEncoder, offset: number ) => T;
};

const DEFAULT_OPTIONS = {
  workgroupSize: 256,
  grainSize: 8,
  combineExpression: null,
  combineStatements: null,
  lengthExpression: null,
  inputOrder: 'blocked',
  inputAccessOrder: 'striped', // TODO: why would we ever want non-striped? hmm (for performance testing?)
  factorOutSubexpressions: true,
  nestSubexpressions: false,
  isReductionExclusive: false,
  exclusive: false
} as const;

export default class TripleReduceScanShader<T> extends ExecutableShader<T[], T[]> {

  public static async create<T>(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: TripleReduceScanShaderOptions<T>
  ): Promise<TripleReduceScanShader<T>> {
    const options = optionize3<TripleReduceScanShaderOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

    const dataCount = options.workgroupSize * options.grainSize;

    const sharedOptions: Record<string, unknown> = {
      valueType: options.valueType,
      identity: options.identityExpression,
      combineExpression: options.combineExpression,
      combineStatements: options.combineStatements,
      workgroupSize: options.workgroupSize,
      grainSize: options.grainSize,
      factorOutSubexpressions: options.factorOutSubexpressions,
      nestSubexpressions: options.nestSubexpressions
    };

    // If we have a non-commutative reduction (with a striped access order)
    const reduceShader = ( options.inputOrder === 'blocked' && options.inputAccessOrder === 'striped' && !options.isCommutative ) ? await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} reduction (non-commutative)`, wgsl_main_reduce_non_commutative, [
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        length: options.lengthExpression,
        stripeOutput: false // TODO: experiment with this
      }, sharedOptions )
    ) : await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} reduction`, wgsl_main_reduce, [
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        convergent: options.isCommutative,
        convergentRemap: false, // TODO: reconsider if we can enable this?
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        length: options.lengthExpression,
        stripeOutput: false // TODO: experiment with this
      }, sharedOptions )
    );

    const middleScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} middle scan`, wgsl_main_scan_reduce, [
        BindingType.STORAGE_BUFFER,
        BindingType.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        // WGSL "ceil" equivalent
        length: options.lengthExpression ? `( ${options.lengthExpression} + ${u32( dataCount - 1 )} ) / ${u32( dataCount )}` : null,
        inputOrder: 'blocked',
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.isReductionExclusive,
        getAddedValue: null,
        stripeReducedOutput: false, // TODO experiment with this!
        inPlace: true
      }, sharedOptions )
    );

    const lowerScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} lower scan`, wgsl_main_scan, [
        BindingType.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        // WGSL "ceil" equivalent
        length: options.lengthExpression ? `( ${options.lengthExpression} + ${u32( dataCount * dataCount - 1 )} ) / ${u32( dataCount * dataCount )}` : null,
        inputOrder: 'blocked',
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.isReductionExclusive,
        getAddedValue: null,
        inPlace: true
      }, sharedOptions )
    );

    const upperScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} upper scan`, wgsl_main_scan_add_2, [
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.READ_ONLY_STORAGE_BUFFER,
        BindingType.STORAGE_BUFFER
      ], combineOptions<ComputeShaderSourceOptions>( {
        length: options.lengthExpression,
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.exclusive,
        isReductionExclusive: options.isReductionExclusive,
        inPlace: false // TODO: allow in-place!
      }, sharedOptions )
    );

    return new TripleReduceScanShader<T>( async ( execution: Execution, values: T[] ) => {
      assert && assert( values.length <= dataCount * dataCount * dataCount );

      const upperDispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.grainSize ) );
      const middleDispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.workgroupSize * options.grainSize * options.grainSize ) );

      const inputBuffer = execution.createByteEncoderBuffer( new ByteEncoder().encodeValues( values, options.encodeElement ) );
      const reductionBuffer = execution.createBuffer( options.bytesPerElement * upperDispatchSize );
      const doubleReductionBuffer = execution.createBuffer( options.bytesPerElement * middleDispatchSize );
      const outputBuffer = execution.createBuffer( options.bytesPerElement * values.length );

      // TODO: allow factoring all of this out, without the "read" at the end! We haven't created the best pattern here.
      execution.dispatch( reduceShader, [
        inputBuffer, reductionBuffer
      ], upperDispatchSize );
      execution.dispatch( middleScanShader, [
        reductionBuffer, doubleReductionBuffer
      ], middleDispatchSize );
      execution.dispatch( lowerScanShader, [
        doubleReductionBuffer
      ] );
      execution.dispatch( upperScanShader, [
        inputBuffer, reductionBuffer, doubleReductionBuffer, outputBuffer
      ], upperDispatchSize );

      return new ByteEncoder( await execution.arrayBuffer( outputBuffer ) ).decodeValues( options.decodeElement, options.bytesPerElement ).slice( 0, values.length );
    } );
  }
}

alpenglow.register( 'TripleReduceScanShader', TripleReduceScanShader );
