// Copyright 2023, University of Colorado Boulder

/**
 * A stack of values (effectively vec4s) that are used by RenderInstructions to evaluate a RenderProgram.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { scenery } from '../../../imports.js';
import Vector4 from '../../../../../dot/js/Vector4.js';

// TODO: We'll plan to use Float32Array to test WebGPU compatibility and epsilons
const ExecutionArrayType = Float64Array;

const STACK_SIZE = 16;
const DATA_SIZE = STACK_SIZE * 4;

type ExecutionData = InstanceType<typeof ExecutionArrayType>;

export default class RenderExecutionStack {
  public data: ExecutionData = new ExecutionArrayType( DATA_SIZE );
  private dataLength = 0;

  public getCurrentIndex(): number {
    return this.dataLength;
  }

  public getLastIndex(): number {
    return this.dataLength - 4;
  }

  public push( vector: Vector4 ): void {
    const index = this.dataLength;
    this.dataLength += 4;
    assert && assert( this.dataLength <= DATA_SIZE, 'Stack overflow' );

    this.data[ index ] = vector.x;
    this.data[ index + 1 ] = vector.y;
    this.data[ index + 2 ] = vector.z;
    this.data[ index + 3 ] = vector.w;
  }

  public pushValues( x: number, y: number, z: number, w: number ): void {
    const index = this.dataLength;
    this.dataLength += 4;
    assert && assert( this.dataLength <= DATA_SIZE, 'Stack overflow' );

    this.data[ index ] = x;
    this.data[ index + 1 ] = y;
    this.data[ index + 2 ] = z;
    this.data[ index + 3 ] = w;
  }

  public popInto( vector: Vector4 ): void {
    this.dataLength -= 4;
    const index = this.dataLength;

    assert && assert( index >= 0, 'Stack underflow' );

    vector.setXYZW( this.data[ index ], this.data[ index + 1 ], this.data[ index + 2 ], this.data[ index + 3 ] );
  }

  public writeTop( vector: Vector4 ): void {
    const index = this.dataLength - 4;
    assert && assert( index >= 0, 'Stack underflow' );

    this.data[ index ] = vector.x;
    this.data[ index + 1 ] = vector.y;
    this.data[ index + 2 ] = vector.z;
    this.data[ index + 3 ] = vector.w;
  }

  public readTop( vector: Vector4 ): void {
    const index = this.dataLength - 4;
    assert && assert( index >= 0, 'Stack underflow' );

    vector.setXYZW( this.data[ index ], this.data[ index + 1 ], this.data[ index + 2 ], this.data[ index + 3 ] );
  }
}

scenery.register( 'RenderExecutionStack', RenderExecutionStack );
