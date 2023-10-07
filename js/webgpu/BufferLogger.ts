// Copyright 2023, University of Colorado Boulder

/**
 * Assists in logging out buffers for WebGPU debugging.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, DeviceContext } from '../imports.js';

const COLLAPSE_LOGS = true;

export type FromArrayBufferable = { fromArrayBuffer: ( arrayBuffer: ArrayBuffer ) => { toString(): string }[] };
export type FromMultiArrayBufferable = { fromArrayBuffer: ( arrayBuffer: ArrayBuffer ) => { toStrings(): string[] }[] };

export default class BufferLogger {

  private readonly callbacksOnComplete: ( () => Promise<void> )[] = [];

  public constructor( private readonly deviceContext: DeviceContext ) {}

  public async complete(): Promise<void> {
    for ( const callback of this.callbacksOnComplete ) {
      await callback();
    }
    this.callbacksOnComplete.length = 0;
  }

  public withBuffer(
    encoder: GPUCommandEncoder,
    buffer: GPUBuffer,
    callback: ( arrayBuffer: ArrayBuffer ) => Promise<void>
  ): void {

    const mappableBuffer = this.deviceContext.createMapReadableBuffer( buffer.size );

    encoder.copyBufferToBuffer( buffer, 0, mappableBuffer, 0, mappableBuffer.size );

    this.callbacksOnComplete.push( async () => {
      const arrayBuffer = await DeviceContext.getMappedArrayBuffer( mappableBuffer );

      await callback( arrayBuffer );

      mappableBuffer.destroy();
    } );
  }

  public logIndexed(
    encoder: GPUCommandEncoder,
    buffer: GPUBuffer,
    name: string,
    type: FromArrayBufferable,
    lengthCallback: ( () => number ) | null = null
  ): void {
    this.withBuffer( encoder, buffer, async arrayBuffer => {
      let elements = type.fromArrayBuffer( arrayBuffer );
      const length = lengthCallback ? lengthCallback() : elements.length;
      elements = elements.slice( 0, length );

      BufferLogger.startGroup( `[buffer] ${name} (${length})` );
      console.log( elements.map( BufferLogger.toIndexedString ).join( '\n' ) );
      BufferLogger.endGroup();
    } );
  }

  public logIndexedMultiline(
    encoder: GPUCommandEncoder,
    buffer: GPUBuffer,
    name: string,
    type: FromMultiArrayBufferable,
    lengthCallback: ( () => number ) | null = null
  ): void {
    this.withBuffer( encoder, buffer, async arrayBuffer => {
      // TODO refactor this bit out
      let elements = type.fromArrayBuffer( arrayBuffer );
      const length = lengthCallback ? lengthCallback() : elements.length;
      elements = elements.slice( 0, length );

      BufferLogger.startGroup( `[buffer] ${name} (${length})` );
      console.log( elements.map( BufferLogger.toMultiIndexedString ).join( '\n' ) );
      BufferLogger.endGroup();
    } );
  }

  public logIndexedImmediate(
    arrayBuffer: ArrayBuffer,
    name: string,
    type: FromArrayBufferable,
    lengthCallback: ( () => number ) | null = null
  ): void {
    this.callbacksOnComplete.push( async () => {
      let elements = type.fromArrayBuffer( arrayBuffer );
      const length = lengthCallback ? lengthCallback() : elements.length;
      elements = elements.slice( 0, length );

      BufferLogger.startGroup( `[buffer] ${name} (${length})` );
      console.log( elements.map( BufferLogger.toIndexedString ).join( '\n' ) );
      BufferLogger.endGroup();
    } );
  }

  public static readonly RasterU32 = {
    fromArrayBuffer( arrayBuffer: ArrayBuffer ): number[] {
      return [ ...new Uint32Array( arrayBuffer ) ];
    }
  };

  public static readonly RasterI32 = {
    fromArrayBuffer( arrayBuffer: ArrayBuffer ): number[] {
      return [ ...new Int32Array( arrayBuffer ) ];
    }
  };

  public static readonly RasterF32 = {
    fromArrayBuffer( arrayBuffer: ArrayBuffer ): number[] {
      return [ ...new Float32Array( arrayBuffer ) ];
    }
  };

  public static toIndexedString( n: { toString(): string }, i: number ): string {
    return `${i} ${n.toString()}`;
  }

  public static toMultiIndexedString( n: { toStrings(): string[] }, i: number ): string {
    const padding = i.toString().replace( /./g, ' ' );
    return n.toStrings().map( ( s, j ) => `${j === 0 ? i : padding} ${s}` ).join( '\n' );
  }

  public static startGroup( name: string ): void {
    if ( COLLAPSE_LOGS ) {
      console.groupCollapsed( name );
    }
    else {
      console.group( name );
    }
  }

  public static endGroup(): void {
    console.groupEnd();
  }
}

alpenglow.register( 'BufferLogger', BufferLogger );
