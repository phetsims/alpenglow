// Copyright 2023, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, ByteEncoder, ComputeShader, DeviceContext, ExecutableShader, Execution, wgsl_main_reduce } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';

export type SingleReduceShaderOptions<T> = {
  // The type of the data for WGSL, e.g. 'f32'
  valueType: string;

  // The number of bytes
  bytesPerElement: number;
  identityExpression: string;

  encodeElement: ( element: T, encoder: ByteEncoder ) => void;
  decodeElement: ( encoder: ByteEncoder, offset: number ) => T;

  // One of these two "combine" options should be provided.
  combineExpression?: ( ( aExpression: string, bExpression: string ) => string ) | null;
  combineStatements?: ( ( varName: string, aExpression: string, bExpression: string ) => string ) | null;

  workgroupSize?: number;
  grainSize?: number;
  lengthExpression?: string | null; // if null, no range checks will be made
  convergent?: boolean;

  // Whether we should remap the data to convergent indices before reducing (i.e. a convergent reduce with non-commutative
  // data.
  convergentRemap?: boolean;

  // The actual ordering of the input data. TODO describe striping order
  inputOrder?: 'blocked' | 'striped';

  // How we access the input data. TODO note consequences of this not matching inputOrder for non-commutative data
  inputAccessOrder?: 'blocked' | 'striped';

  factorOutSubexpressions?: boolean;

  nestSubexpressions?: boolean;

  stripeOutput?: boolean;
};

const DEFAULT_OPTIONS = {
  workgroupSize: 256,
  grainSize: 8,
  combineExpression: null,
  combineStatements: null,
  lengthExpression: null,
  convergent: false,
  convergentRemap: false,
  inputOrder: 'blocked',
  inputAccessOrder: 'blocked',
  factorOutSubexpressions: true,
  nestSubexpressions: false,
  stripeOutput: false
} as const;

export default class SingleReduceShader<T> extends ExecutableShader<T[], T[]> {

  public static async create<T>(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: SingleReduceShaderOptions<T>
  ): Promise<SingleReduceShader<T>> {
    const options = optionize3<SingleReduceShaderOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

    const shader = await ComputeShader.fromSourceAsync(
      deviceContext.device, name, wgsl_main_reduce, [
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
        convergent: options.convergent,
        convergentRemap: options.convergentRemap,
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        factorOutSubexpressions: options.factorOutSubexpressions,
        nestSubexpressions: options.nestSubexpressions,
        stripeOutput: options.stripeOutput
      }
    );

    return new SingleReduceShader<T>( async ( execution: Execution, values: T[] ) => {
      const dispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.grainSize ) );

      const inputBuffer = execution.createByteEncoderBuffer( new ByteEncoder().encodeValues( values, options.encodeElement ) );
      const outputBuffer = execution.createBuffer( options.bytesPerElement * dispatchSize );

      execution.dispatch( shader, [
        inputBuffer, outputBuffer
      ], dispatchSize );

      return new ByteEncoder( await execution.arrayBuffer( outputBuffer ) ).decodeValues( options.decodeElement, options.bytesPerElement ).slice( 0, dispatchSize );
    } );
  }
}

alpenglow.register( 'SingleReduceShader', SingleReduceShader );
