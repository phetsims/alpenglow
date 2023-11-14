// Copyright 2023, University of Colorado Boulder

/**
 * A two-level standalone scan. TODO: more docs about the approach
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, ByteEncoder, ComputeShader, DeviceContext, ExecutableShader, Execution, u32, wgsl_main_reduce, wgsl_main_scan_replace, wgsl_main_scan_replace_add_1 } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';

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
  inputOrder?: 'blocked' | 'striped';

  // How we access the input data.
  inputAccessOrder?: 'blocked' | 'striped';

  factorOutSubexpressions?: boolean;
  nestSubexpressions?: boolean;

  isReductionExclusive?: boolean; // TODO: tests!

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
  inputAccessOrder: 'striped', // TODO: why would we ever want non-striped? hmm
  factorOutSubexpressions: true,
  nestSubexpressions: false,
  isReductionExclusive: false,
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

    const reduceShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} reduction`, wgsl_main_reduce, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        valueType: options.valueType,
        identity: options.identityExpression,
        combineExpression: options.combineExpression,
        combineStatements: options.combineStatements,
        length: options.lengthExpression,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        convergent: options.isCommutative,
        convergentRemap: false, // TODO: reconsider if we can enable this?
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        factorOutSubexpressions: options.factorOutSubexpressions,
        nestSubexpressions: options.nestSubexpressions,
        stripeOutput: false // TODO: experiment with this
      }
    );

    const lowerScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} lower scan`, wgsl_main_scan_replace, [
        Binding.STORAGE_BUFFER
      ], {
        valueType: options.valueType,
        identity: options.identityExpression,
        combineExpression: options.combineExpression,
        combineStatements: options.combineStatements,
        // WGSL "ceil" equivalent
        length: options.lengthExpression ? `( ${options.lengthExpression} + ${u32( dataCount - 1 )} ) / ${u32( dataCount )}` : null,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        inputOrder: 'blocked',
        inputAccessOrder: options.inputAccessOrder,
        factorOutSubexpressions: options.factorOutSubexpressions,
        exclusive: options.isReductionExclusive,
        getAddedValue: null
      }
    );

    const upperScanShader = await ComputeShader.fromSourceAsync(
      deviceContext.device, `${name} upper scan`, wgsl_main_scan_replace_add_1, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        valueType: options.valueType,
        identity: options.identityExpression,
        combineExpression: options.combineExpression,
        combineStatements: options.combineStatements,
        length: options.lengthExpression,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        factorOutSubexpressions: options.factorOutSubexpressions,
        exclusive: options.exclusive,
        isReductionExclusive: options.isReductionExclusive
      }
    );

    return new DoubleReduceScanShader<T>( async ( execution: Execution, values: T[] ) => {
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
