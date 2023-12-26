// Copyright 2023, University of Colorado Boulder

/**
 * Assorted example shaders, that might be run from unit tests, performance benchmarking, etc.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, OldBindingType, OldComputeShader, DeviceContext, ExecutableShader, OldExecution, wgsl_f32_reduce_simple } from '../../imports.js';

export class OldExampleSimpleF32Reduce extends ExecutableShader<number[], number> {

  public static async create(
    deviceContext: DeviceContext,
    name: string,
    options: {
      workgroupSize: number;
      inputSize: number;
    }
  ): Promise<OldExampleSimpleF32Reduce> {
    const shader = await OldComputeShader.fromSourceAsync(
      deviceContext.device, name, wgsl_f32_reduce_simple, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], {
        workgroupSize: options.workgroupSize,
        inputSize: options.inputSize,
        identity: '0f',
        combine: ( a: string, b: string ) => `${a} + ${b}`
      }
    );

    return new OldExampleSimpleF32Reduce( async ( execution: OldExecution, numbers: number[] ) => {
      assert && assert( numbers.length >= options.inputSize );

      const inputBuffer = execution.createF32Buffer( numbers );
      const outputBuffer = execution.createBuffer( 4 );

      execution.dispatch( shader, [
        inputBuffer, outputBuffer
      ] );

      return ( await execution.f32Numbers( outputBuffer ) )[ 0 ];
    } );
  }
}

alpenglow.register( 'OldExampleSimpleF32Reduce', OldExampleSimpleF32Reduce );

// Bicyclic semigroup object, a good example of a non-commutative operation
export class OldBic {
  public constructor(
    public readonly x: number,
    public readonly y: number
  ) {}

  public getNumbers(): [ number, number ] {
    return [ this.x, this.y ];
  }

  public equals( other: OldBic ): boolean {
    return this.x === other.x && this.y === other.y;
  }

  public toString(): string {
    return `Bic( ${this.x}, ${this.y} )`;
  }

  public static combine( a: OldBic, b: OldBic ): OldBic {
    const min = Math.min( a.y, b.x );
    return new OldBic(
      a.x + b.x - min,
      a.y + b.y - min
    );
  }

  public static readonly IDENTITY = new OldBic( 0, 0 );

  public static combineMultiple( ...values: OldBic[] ): OldBic {
    let bic = OldBic.IDENTITY;
    values.forEach( value => {
      bic = OldBic.combine( bic, value );
    } );
    return bic;
  }

  public static readonly BYTES = 8;
}

alpenglow.register( 'OldBic', OldBic );
