// Copyright 2023, University of Colorado Boulder

/**
 * A two-level standalone scan.
 *
 * Three stages:
 *
 * 1. A level of reduction (takes the "upper" input data, and reduces it to a single value per workgroup, saved in reduces)
 * 2. Scan of the reduces (the entire "lower" data will fit within a single workgroup)
 * 3. Scan of the original data, where the relevant reduce is added to each workgroup's elements.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, OldBindingType, ByteEncoder, OldComputeShader, OldComputeShaderSourceOptions, DeviceContext, ExecutableShader, OldExecution, u32, wgsl_main_reduce, wgsl_main_reduce_non_commutative, wgsl_main_scan, wgsl_main_scan_add_1 } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';

export type DoubleReduceScanShaderOptions<T> = {

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

  internalStriping?: false; // TODO: fix the feature!

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
  internalStriping: false,
  exclusive: false
} as const;

export default class DoubleReduceScanShader<T> extends ExecutableShader<T[], T[]> {

  public static async create<T>(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: DoubleReduceScanShaderOptions<T>
  ): Promise<DoubleReduceScanShader<T>> {
    const options = optionize3<DoubleReduceScanShaderOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

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
    const reduceShader = ( options.inputOrder === 'blocked' && options.inputAccessOrder === 'striped' && !options.isCommutative ) ? await OldComputeShader.fromSourceAsync(
      deviceContext.device, `${name} reduction (non-commutative)`, wgsl_main_reduce_non_commutative, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        length: options.lengthExpression,
        stripeOutput: options.internalStriping
      }, sharedOptions )
    ) : await OldComputeShader.fromSourceAsync(
      deviceContext.device, `${name} reduction`, wgsl_main_reduce, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        length: options.lengthExpression,
        convergent: options.isCommutative,
        convergentRemap: false, // NOTE: could consider trying to enable this, but probably not worth it
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        stripeOutput: options.internalStriping
      }, sharedOptions )
    );

    const lowerScanShader = await OldComputeShader.fromSourceAsync(
      deviceContext.device, `${name} lower scan`, wgsl_main_scan, [
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        // WGSL "ceil" equivalent
        length: options.lengthExpression ? `( ${options.lengthExpression} + ${u32( dataCount - 1 )} ) / ${u32( dataCount )}` : null,
        inputOrder: options.internalStriping ? 'striped' : 'blocked',
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.isReductionExclusive,
        getAddedValue: null,
        inPlace: true
      }, sharedOptions )
    );

    const upperScanShader = await OldComputeShader.fromSourceAsync(
      deviceContext.device, `${name} upper scan`, wgsl_main_scan_add_1, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        length: options.lengthExpression,
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.exclusive,
        isReductionExclusive: options.isReductionExclusive,
        inPlace: false // TODO: allow in-place!
      }, sharedOptions )
    );

    return new DoubleReduceScanShader<T>( async ( execution: OldExecution, values: T[] ) => {
      assert && assert( values.length <= dataCount * dataCount );

      const upperDispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.grainSize ) );

      const inputBuffer = execution.createByteEncoderBuffer( new ByteEncoder().encodeValues( values, options.encodeElement ) );
      const reductionBuffer = execution.createBuffer( options.bytesPerElement * upperDispatchSize );
      const outputBuffer = execution.createBuffer( options.bytesPerElement * values.length );

      execution.dispatch( reduceShader, [
        inputBuffer, reductionBuffer
      ], upperDispatchSize );
      execution.dispatch( lowerScanShader, [
        reductionBuffer
      ] );
      execution.dispatch( upperScanShader, [
        inputBuffer, reductionBuffer, outputBuffer
      ], upperDispatchSize );

      return new ByteEncoder( await execution.arrayBuffer( outputBuffer ) ).decodeValues( options.decodeElement, options.bytesPerElement ).slice( 0, values.length );
    } );
  }
}

alpenglow.register( 'DoubleReduceScanShader', DoubleReduceScanShader );
