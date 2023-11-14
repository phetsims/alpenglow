// Copyright 2023, University of Colorado Boulder

/**
 * A single level of standalone scan.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, ByteEncoder, ComputeShader, DeviceContext, ExecutableShader, Execution, wgsl_main_scan } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';

export type SingleScanShaderOptions<T> = {

  // The type of the data for WGSL, e.g. 'f32'
  valueType: string;

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

  // Writes into a value that will be added to everything in the scan
  getAddedValue?: ( ( varName: string ) => string ) | null;

  factorOutSubexpressions?: boolean;

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
  exclusive: false,
  getAddedValue: null
} as const;

export default class SingleScanShader<T> extends ExecutableShader<T[], T[]> {

  public static async create<T>(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: SingleScanShaderOptions<T>
  ): Promise<SingleScanShader<T>> {
    const options = optionize3<SingleScanShaderOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

    const shader = await ComputeShader.fromSourceAsync(
      deviceContext.device, name, wgsl_main_scan, [
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
        getAddedValue: options.getAddedValue
      }
    );

    return new SingleScanShader<T>( async ( execution: Execution, values: T[] ) => {
      const dispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.grainSize ) );

      const inputBuffer = execution.createByteEncoderBuffer( new ByteEncoder().encodeValues( values, options.encodeElement ) );
      const outputBuffer = execution.createBuffer( options.bytesPerElement * values.length );

      execution.dispatch( shader, [
        inputBuffer, outputBuffer
      ], dispatchSize );

      return new ByteEncoder( await execution.arrayBuffer( outputBuffer ) ).decodeValues( options.decodeElement, options.bytesPerElement ).slice( 0, values.length );
    } );
  }
}

alpenglow.register( 'SingleScanShader', SingleScanShader );
