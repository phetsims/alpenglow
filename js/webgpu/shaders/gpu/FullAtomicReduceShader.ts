// Copyright 2023, University of Colorado Boulder

/**
 * A reduction of u32/i32 with (even more) atomics so that we can achieve it in a single level.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, AtomicOperation, AtomicReduceShader, AtomicType, OldBindingType, ByteEncoder, OldComputeShader, DeviceContext, ExecutableShader, OldExecution, wgsl_main_atomic_reduce_atomic } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type FullAtomicReduceShaderOptions = {
  // The type of the data for WGSL, e.g. 'f32'
  valueType: AtomicType;

  atomicOperation: AtomicOperation;

  workgroupSize?: number;
  grainSize?: number;
  lengthExpression?: string | null; // if null, no range checks will be made

  // TODO: doc
  numAtomics?: number;

  // TODO: doc
  directAtomics?: boolean;
};

const DEFAULT_OPTIONS = {
  workgroupSize: 256,
  grainSize: 8,
  lengthExpression: null,
  numAtomics: 8,
  directAtomics: false
} as const;

export default class FullAtomicReduceShader extends ExecutableShader<number[], number> {

  public static async create(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: FullAtomicReduceShaderOptions
  ): Promise<FullAtomicReduceShader> {
    const options = optionize3<FullAtomicReduceShaderOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

    const shader = await OldComputeShader.fromSourceAsync(
      deviceContext.device, name, wgsl_main_atomic_reduce_atomic, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        valueType: options.valueType,
        atomicOperation: options.atomicOperation,
        identity: AtomicReduceShader.getIdentityExpression( options.atomicOperation, options.valueType ),
        length: options.lengthExpression,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        numAtomics: options.numAtomics,
        directAtomics: options.directAtomics
      }
    );

    return new FullAtomicReduceShader( async ( execution: OldExecution, values: number[] ) => {
      const dispatchSize = Math.ceil( values.length / ( options.workgroupSize * options.grainSize ) );

      const byteEncoder = new ByteEncoder().encodeValues( values, ( element, encoder ) => {
        if ( options.valueType === 'u32' ) {
          encoder.pushU32( element );
        }
        else {
          encoder.pushI32( element );
        }
      } );

      const inputBuffer = execution.createByteEncoderBuffer( byteEncoder );

      // We have to conditionally initialize the atomic result!
      const identityValue = AtomicReduceShader.getIdentityNumericValue( options.atomicOperation, options.valueType );
      const outputBuffer = identityValue === 0 ? execution.createBuffer( 4 * dispatchSize ) : (
        options.valueType === 'u32'
          ? execution.createU32Buffer( [ identityValue ] )
          : execution.createI32Buffer( [ identityValue ] )
      );

      execution.dispatch( shader, [
        inputBuffer, outputBuffer
      ], dispatchSize );

      const arrayBuffer = await execution.arrayBuffer( outputBuffer );
      const array = options.valueType === 'u32' ? new Uint32Array( arrayBuffer ) : new Int32Array( arrayBuffer );
      return array[ 0 ];
    } );
  }
}

alpenglow.register( 'FullAtomicReduceShader', FullAtomicReduceShader );
