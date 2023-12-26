// Copyright 2023, University of Colorado Boulder

/**
 * A reduction of u32/i32 with atomics so that we can achieve it in a single level.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, OldBindingType, ByteEncoder, OldComputeShader, DeviceContext, ExecutableShader, OldExecution, i32, u32, wgsl_main_reduce_atomic } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

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

export const u32AtomicIdentities = {
  atomicAdd: 0,
  atomicMax: 0,
  atomicMin: 0xffffffff,
  atomicAnd: 0xffffffff,
  atomicOr: 0,
  atomicXor: 0
} as const;

// TODO: double-check some of these
export const i32AtomicIdentities = {
  atomicAdd: 0,
  // atomicMax: -0x80000000, // what, why can't this be represented?
  atomicMax: -0x7fffffff,
  atomicMin: 0x7fffffff,
  atomicAnd: -1,
  atomicOr: 0,
  atomicXor: 0
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

    const shader = await OldComputeShader.fromSourceAsync(
      deviceContext.device, name, wgsl_main_reduce_atomic, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        valueType: options.valueType,
        atomicOperation: options.atomicOperation,
        inputOrder: options.inputOrder,
        identity: AtomicReduceShader.getIdentityExpression( options.atomicOperation, options.valueType ),
        combineExpression: combineExpressions[ options.atomicOperation ],
        length: options.lengthExpression,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        factorOutSubexpressions: options.factorOutSubexpressions,
        nestSubexpressions: options.nestSubexpressions
      }
    );

    return new AtomicReduceShader( async ( execution: OldExecution, values: number[] ) => {
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

  public static getIdentityNumericValue( atomicOperation: AtomicOperation, valueType: AtomicType ): number {
    return ( valueType === 'u32' ? u32AtomicIdentities : i32AtomicIdentities )[ atomicOperation ];
  }

  public static getIdentityExpression( atomicOperation: AtomicOperation, valueType: AtomicType ): string {
    const identityValue = AtomicReduceShader.getIdentityNumericValue( atomicOperation, valueType );
    return valueType === 'u32' ? u32( identityValue ) : i32( identityValue );
  }
}

alpenglow.register( 'AtomicReduceShader', AtomicReduceShader );
