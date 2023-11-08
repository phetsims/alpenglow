// Copyright 2023, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, ByteEncoder, ComputeShader, DeviceContext, ExecutableShader, Execution, wgsl_main_reduce_atomic } from '../../imports.js';
import { optionize3 } from '../../../../phet-core/js/optionize.js';

export type AtomicType = 'u32' | 'i32';

export type AtomicOperation =
  'atomicAdd' |
  'atomicMax' |
  'atomicMin' |
  'atomicAnd' |
  'atomicOr' |
  'atomicXor';

export type AtomicReduceShaderOptions = {
  // The type of the data for WGSL, e.g. 'f32'
  valueType: AtomicType;

  atomicOperation: AtomicOperation;

  workgroupSize?: number;
  grainSize?: number;
  lengthExpression?: string | null; // if null, no range checks will be made

  // The actual ordering of the input data. TODO describe striping order
  inputOrder?: 'blocked' | 'striped';

  factorOutSubexpressions?: boolean;
  nestSubexpressions?: boolean;
};

const DEFAULT_OPTIONS = {
  workgroupSize: 256,
  grainSize: 8,
  lengthExpression: null,
  factorOutSubexpressions: true,
  nestSubexpressions: false,
  inputOrder: 'blocked'
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

const combineExpressions = {
  atomicAdd: ( a: string, b: string ) => `${a} + ${b}`,
  atomicMax: ( a: string, b: string ) => `max( ${a}, ${b} )`,
  atomicMin: ( a: string, b: string ) => `min( ${a}, ${b} )`,
  atomicAnd: ( a: string, b: string ) => `${a} & ${b}`,
  atomicOr: ( a: string, b: string ) => `${a} | ${b}`,
  atomicXor: ( a: string, b: string ) => `${a} ^ ${b}`
} as const;

export default class AtomicReduceShader extends ExecutableShader<number[], number> {

  public static async create(
    deviceContext: DeviceContext,
    name: string,
    providedOptions: AtomicReduceShaderOptions
  ): Promise<AtomicReduceShader> {
    const options = optionize3<AtomicReduceShaderOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

    const shader = await ComputeShader.fromSourceAsync(
      deviceContext.device, name, wgsl_main_reduce_atomic, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        valueType: options.valueType,
        atomicOperation: options.atomicOperation,
        inputOrder: options.inputOrder,
        identity: ( options.valueType === 'u32' ? u32Identities : i32Identities )[ options.atomicOperation ],
        combineExpression: combineExpressions[ options.atomicOperation ],
        length: options.lengthExpression,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        factorOutSubexpressions: options.factorOutSubexpressions,
        nestSubexpressions: options.nestSubexpressions
      }
    );

    return new AtomicReduceShader( async ( execution: Execution, values: number[] ) => {
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

alpenglow.register( 'AtomicReduceShader', AtomicReduceShader );
