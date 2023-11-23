// Copyright 2023, University of Colorado Boulder

/**
 * A single level of standalone scan.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, Binding, ByteEncoder, ComputeShader, DeviceContext, ExecutableShader, Execution, wgsl_main_scan } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';

export type SingleScanShaderOptions<T> = {
  binaryOp: BinaryOp<T>;

  exclusive?: boolean;

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

  log?: boolean;
};

const DEFAULT_OPTIONS = {
  workgroupSize: 256,
  grainSize: 8,
  lengthExpression: null,
  inputOrder: 'blocked',
  inputAccessOrder: 'striped', // TODO: why would we ever want non-striped? hmm
  factorOutSubexpressions: true,
  exclusive: false,
  getAddedValue: null,

  log: false
} as const;

export default class SingleScanShader<T> extends ExecutableShader<T[], T[]> {

  public static async create<T>(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: SingleScanShaderOptions<T>
  ): Promise<SingleScanShader<T>> {
    const options = optionize3<SingleScanShaderOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

    const binaryOp = options.binaryOp;
    const type = binaryOp.type;

    const shader = await ComputeShader.fromSourceAsync(
      deviceContext.device, name, wgsl_main_scan, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        valueType: type.valueType,
        identity: binaryOp.identityWGSL,
        combineExpression: binaryOp.combineExpression,
        combineStatements: binaryOp.combineExpression ? null : binaryOp.combineStatements,
        length: options.lengthExpression,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        factorOutSubexpressions: options.factorOutSubexpressions,
        exclusive: options.exclusive,
        getAddedValue: options.getAddedValue,
        log: options.log
      }
    );

    return new SingleScanShader<T>( async ( execution: Execution, values: T[] ) => {
      const dispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.grainSize ) );

      const inputBuffer = execution.createByteEncoderBuffer( new ByteEncoder().encodeValues( values, type.encode ) );
      const outputBuffer = execution.createBuffer( type.bytesPerElement * values.length );

      execution.dispatch( shader, [
        inputBuffer, outputBuffer
      ], dispatchSize );

      return new ByteEncoder( await execution.arrayBuffer( outputBuffer ) ).decodeValues( type.decode, type.bytesPerElement ).slice( 0, values.length );
    }, options );
  }
}

alpenglow.register( 'SingleScanShader', SingleScanShader );
