// Copyright 2023, University of Colorado Boulder

/**
 * An appendable/settable buffer of bytes
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';

export type F32 = number;
export type U32 = number;
export type U8 = number;
export type U16 = number;

const scratchForBytes = new Uint8Array( 4 );

export default class ByteEncoder {

  private _byteLength: number;
  private _arrayBuffer: ArrayBuffer;
  private _f32Array: Float32Array;
  private _u32Array: Uint32Array;
  private _u8Array: Uint8Array;

  public constructor( initialSize = 512 ) {
    this._byteLength = 0;

    // TODO: resizable buffers once supported by Firefox, use maxByteLength (no copying!!!)
    this._arrayBuffer = new ArrayBuffer( initialSize );
    this._f32Array = new Float32Array( this._arrayBuffer );
    this._u32Array = new Uint32Array( this._arrayBuffer );
    this._u8Array = new Uint8Array( this._arrayBuffer );
  }

  // Direct access, for when performance is helpful
  public get fullU8Array(): Uint8Array {
    return this._u8Array;
  }
  public get fullU32Array(): Uint32Array {
    return this._u32Array;
  }
  public get fullF32Array(): Float32Array {
    return this._f32Array;
  }

  public get u8Array(): Uint8Array {
    return new Uint8Array( this._arrayBuffer, 0, this._byteLength );
  }
  public get u32Array(): Uint32Array {
    return new Uint32Array( this._arrayBuffer, 0, this._byteLength / 4 );
  }
  public get f32Array(): Float32Array {
    return new Float32Array( this._arrayBuffer, 0, this._byteLength / 4 );
  }

  public clear(): void {
    this._byteLength = 0;
    this._u8Array.fill( 0 );
  }

  public pushByteEncoder( byteBuffer: ByteEncoder ): void {
    // TODO: this is a hot spot, optimize
    this.ensureSpaceFor( byteBuffer._byteLength );

    this._u8Array.set( byteBuffer._u8Array.slice( 0, byteBuffer._byteLength ), this._byteLength );
    this._byteLength += byteBuffer._byteLength;
  }

  public pushF32( f32: F32 ): void {
    this.ensureSpaceFor( 4 );
    // If aligned, use the faster _f32Array
    if ( this._byteLength % 4 === 0 ) {
      this._f32Array[ this._byteLength / 4 ] = f32;
    }
    else {
      const bytes = ByteEncoder.f32ToBytes( f32 );
      this._u8Array.set( bytes, this._byteLength );
    }
    this._byteLength += 4;
  }

  public pushU32( u32: U32 ): void {
    this.ensureSpaceFor( 4 );
    // If aligned, use the faster _u32Array
    if ( this._byteLength % 4 === 0 ) {
      this._u32Array[ this._byteLength / 4 ] = u32;
    }
    else {
      const bytes = ByteEncoder.u32ToBytes( u32 );
      this._u8Array.set( bytes, this._byteLength );
    }
    this._byteLength += 4;
  }

  public pushReversedU32( u32: U32 ): void {
    this.ensureSpaceFor( 4 );

    const bytes = ByteEncoder.u32ToBytes( u32 ).reverse();
    this._u8Array.set( bytes, this._byteLength );

    this._byteLength += 4;
  }

  public pushU8( u8: U8 ): void {
    this.ensureSpaceFor( 1 );
    this._u8Array[ this._byteLength ] = u8;
    this._byteLength += 1;
  }

  public pushU16( u8: U8 ): void {
    this.ensureSpaceFor( 2 );
    this._u8Array[ this._byteLength ] = u8 & 0xff;
    this._u8Array[ this._byteLength + 1 ] = u8 >> 8;
    this._byteLength += 2;
  }

  public get byteLength(): number {
    return this._byteLength;
  }

  public set byteLength( byteLength: number ) {
    // Don't actually expand below
    if ( byteLength > this._arrayBuffer.byteLength ) {
      this.resize( byteLength );
    }
    this._byteLength = byteLength;
  }

  private ensureSpaceFor( byteLength: number ): void {
    const requiredByteLength = this._byteLength + byteLength;
    if ( this._byteLength + byteLength > this._arrayBuffer.byteLength ) {
      this.resize( Math.max( this._arrayBuffer.byteLength * 2, requiredByteLength ) );
    }
  }

  // NOTE: this MAY truncate
  public resize( byteLength = 0 ): void {
    // TODO: This is a hot-spot!
    byteLength = byteLength || this._arrayBuffer.byteLength * 2;
    byteLength = Math.ceil( byteLength / 4 ) * 4; // Round up to nearest 4 (for alignment)
    // Double the size of the _arrayBuffer by default, copying memory
    const newArrayBuffer = new ArrayBuffer( byteLength );
    const newU8Array = new Uint8Array( newArrayBuffer );
    newU8Array.set( this._u8Array.slice( 0, Math.min( this._byteLength, byteLength ) ) );
    this._arrayBuffer = newArrayBuffer;
    this._f32Array = new Float32Array( this._arrayBuffer );
    this._u32Array = new Uint32Array( this._arrayBuffer );
    this._u8Array = new Uint8Array( this._arrayBuffer );
  }

  public static alignUp( len: number, alignment: number ): number {
    assert && assert( Number.isInteger( Math.log2( alignment ) ) );

    return len + ( ( ( ~len ) + 1 ) & ( alignment - 1 ) );
  }

  public static nextMultipleOf( val: number, rhs: number ): number {
    const r = val % rhs;
    return r === 0 ? val : val + ( rhs - r );
  }

  /**
   * Convert f32 to 4 bytes in little endian order
   */
  public static f32ToBytes( float: number ): U8[] {
    const view = new DataView( scratchForBytes.buffer );
    view.setFloat32( 0, float );
    return [ ...scratchForBytes ].reverse();
  }

  /**
   * Convert u32 to 4 bytes in little endian order
   */
  public static u32ToBytes( int: number ): U8[] {
    const view = new DataView( scratchForBytes.buffer );
    view.setUint32( 0, int );
    return [ ...scratchForBytes ].reverse();
  }
}

alpenglow.register( 'ByteEncoder', ByteEncoder );
