// Copyright 2023, University of Colorado Boulder

/**
 * A reduction of u32/i32 with (even more) atomics so that we can achieve it in a single level.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, AtomicOperation, AtomicType, Binding, ByteEncoder, ComputeShader, DeviceContext, ExecutableShader, Execution, wgsl_main_atomic_reduce_atomic } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';

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

const u32Identities = {
  atomicAdd: '0u',
  atomicMax: '0u',
  atomicMin: '0xffffffffu',
  atomicAnd: '0xffffffffu',
  atomicOr: '0u',
  atomicXor: '0u'
} as const;

// TODO: double-check some of these
const i32Identities = {
  atomicAdd: '0i',
  // atomicMax: '-0x80000000i', // what, why can't this be represented?
  atomicMax: '-0x7fffffffi',
  atomicMin: '0x7fffffffi',
  atomicAnd: '-1i',
  atomicOr: '0i',
  atomicXor: '0i'
} as const;

export default class FullAtomicReduceShader extends ExecutableShader<number[], number> {

  public static async create(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: FullAtomicReduceShaderOptions
  ): Promise<FullAtomicReduceShader> {
    const options = optionize3<FullAtomicReduceShaderOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

    const shader = await ComputeShader.fromSourceAsync(
      deviceContext.device, name, wgsl_main_atomic_reduce_atomic, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        valueType: options.valueType,
        atomicOperation: options.atomicOperation,
        identity: ( options.valueType === 'u32' ? u32Identities : i32Identities )[ options.atomicOperation ],
        length: options.lengthExpression,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        numAtomics: options.numAtomics,
        directAtomics: options.directAtomics
      }
    );

    return new FullAtomicReduceShader( async ( execution: Execution, values: number[] ) => {
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
      const outputBuffer = execution.createBuffer( 4 * dispatchSize );

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
