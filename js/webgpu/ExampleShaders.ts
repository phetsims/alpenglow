// Copyright 2023, University of Colorado Boulder

/**
 * Assorted example shaders, that might be run from unit tests, performance benchmarking, etc.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, ComputeShader, DeviceContext, ExecutableShader, ExecutableShaderTemplate, Execution, wgsl_f32_reduce_simple } from '../imports.js';

export default class ExampleShaders {
  public static getSimpleF32Reduce( options: {
    workgroupSize: number;
    inputSize: number;
  } ): ExecutableShaderTemplate<number[], number> {
    return async ( deviceContext: DeviceContext ) => {
      const shader = await ComputeShader.fromSourceAsync(
        deviceContext.device, 'f32_reduce_simple', wgsl_f32_reduce_simple, [
          Binding.READ_ONLY_STORAGE_BUFFER,
          Binding.STORAGE_BUFFER
        ], {
          workgroupSize: options.workgroupSize,
          inputSize: options.inputSize,
          identity: '0f',
          combine: ( a: string, b: string ) => `${a} + ${b}`
        }
      );

      return new ExecutableShader( async ( execution: Execution, numbers: number[] ) => {
        assert && assert( numbers.length >= options.inputSize );

        const inputBuffer = execution.createF32Buffer( numbers );
        const outputBuffer = execution.createBuffer( 4 );

        execution.dispatch( shader, [
          inputBuffer, outputBuffer
        ] );

        return ( await execution.f32Numbers( outputBuffer ) )[ 0 ];
      } );
    };
  }
}

alpenglow.register( 'ExampleShaders', ExampleShaders );

// Bicyclic semigroup object, a good example of a non-commutative operation
export class Bic {
  public constructor(
    public readonly x: number,
    public readonly y: number
  ) {}

  public getNumbers(): [ number, number ] {
    return [ this.x, this.y ];
  }

  public equals( other: Bic ): boolean {
    return this.x === other.x && this.y === other.y;
  }

  public toString(): string {
    return `Bic( ${this.x}, ${this.y} )`;
  }

  public static combine( a: Bic, b: Bic ): Bic {
    const min = Math.min( a.y, b.x );
    return new Bic(
      a.x + b.x - min,
      a.y + b.y - min
    );
  }

  public static readonly IDENTITY = new Bic( 0, 0 );

  public static combineMultiple( ...values: Bic[] ): Bic {
    let bic = Bic.IDENTITY;
    values.forEach( value => {
      bic = Bic.combine( bic, value );
    } );
    return bic;
  }

  public static readonly BYTES = 8;
}

alpenglow.register( 'Bic', Bic );
