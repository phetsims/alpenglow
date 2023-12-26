// Copyright 2023, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, OldBindingType, ByteEncoder, OldComputeShader, DeviceContext, ExecutableShader, ExecutableShaderExternalOptions, OldExecution, mainReduceWGSL, mainReduceWGSLOptions, WGSLContext, PipelineLayout } from '../../../imports.js';

export type SingleReduceShaderOptions<T> = mainReduceWGSLOptions<T> & ExecutableShaderExternalOptions<T[], T[]>;

// @deprecated
export default class SingleReduceShader<T> extends ExecutableShader<T[], T[]> {

  public static async create<T>(
    deviceContext: DeviceContext,
    name: string,
    options: SingleReduceShaderOptions<T>
  ): Promise<SingleReduceShader<T>> {

    const shader = await OldComputeShader.fromContextAsync(
      deviceContext.device,
      name,
      // TODO: eeek! (also deprecate)
      new WGSLContext( name, null as unknown as PipelineLayout, !!options.log ).with( context => mainReduceWGSL( context, options ) ),
      [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ]
    );

    const type = options.binaryOp.type;

    return new SingleReduceShader<T>( async ( execution: OldExecution, values: T[] ) => {
      const dispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.grainSize ) );

      const inputBuffer = execution.createByteEncoderBuffer( new ByteEncoder().encodeValues( values, type.encode ) );
      const outputBuffer = execution.createBuffer( type.bytesPerElement * dispatchSize );

      execution.dispatch( shader, [
        inputBuffer, outputBuffer
      ], dispatchSize );

      return new ByteEncoder( await execution.arrayBuffer( outputBuffer ) ).decodeValues( type.decode, type.bytesPerElement ).slice( 0, dispatchSize );
    }, {
      log: options.log
    } );
  }
}

alpenglow.register( 'SingleReduceShader', SingleReduceShader );
