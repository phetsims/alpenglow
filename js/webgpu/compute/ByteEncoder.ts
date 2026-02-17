// Copyright 2023-2025, University of Colorado Boulder

/**
 * An appendable/settable buffer of bytes
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';

export type F32 = number;
export type U32 = number;
export type I32 = number;
export type U8 = number;

const scratchForBytes = new Uint8Array( 4 );

export class ByteEncoder {

  private _byteLength: number;
  private _arrayBuffer: ArrayBuffer;
  declare private _f32Array: Float32Array;
  declare private _i32Array: Int32Array;
  declare private _u32Array: Uint32Array;
  declare private _u8Array: Uint8Array;

  public constructor(
    // Allow creating it with an existing ArrayBuffer (which can have a specific starting length)
    arrayBuffer?: ArrayBuffer
  ) {

    if ( arrayBuffer ) {
      this._byteLength = arrayBuffer.byteLength;
      this._arrayBuffer = arrayBuffer;
    }
    else {
      this._byteLength = 0;

      // TODO: resizable buffers once supported by Firefox, use maxByteLength (no copying!!!)
      this._arrayBuffer = new ArrayBuffer( 512 ); // Don't require crazy expansion, so start with a default
    }

    this.setTypedArrays();
  }

  // Direct access, for when performance is helpful
  public get fullU8Array(): Uint8Array {
    return this._u8Array;
  }
  public get fullU32Array(): Uint32Array {
    return this._u32Array;
  }
  public get fullI32Array(): Int32Array {
    return this._i32Array;
  }
  public get fullF32Array(): Float32Array {
    return this._f32Array;
  }
  public get fullArrayBuffer(): ArrayBuffer {
    return this._arrayBuffer;
  }

  public get u8Array(): Uint8Array {
    return new Uint8Array( this._arrayBuffer, 0, this._byteLength );
  }
  public get u32Array(): Uint32Array {
    return new Uint32Array( this._arrayBuffer, 0, this._byteLength / 4 );
  }
  public get i32Array(): Int32Array {
    return new Int32Array( this._arrayBuffer, 0, this._byteLength / 4 );
  }
  public get f32Array(): Float32Array {
    return new Float32Array( this._arrayBuffer, 0, this._byteLength / 4 );
  }
  public get arrayBuffer(): ArrayBuffer {
    return this._arrayBuffer.slice( 0, this._byteLength );
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

  public pushI32( i32: I32 ): void {
    this.ensureSpaceFor( 4 );
    // If aligned, use the faster _i32Array
    if ( this._byteLength % 4 === 0 ) {
      this._i32Array[ this._byteLength / 4 ] = i32;
    }
    else {
      const bytes = ByteEncoder.i32ToBytes( i32 );
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

  private setTypedArrays(): void {
    this._f32Array = new Float32Array( this._arrayBuffer );
    this._i32Array = new Int32Array( this._arrayBuffer );
    this._u32Array = new Uint32Array( this._arrayBuffer );
    this._u8Array = new Uint8Array( this._arrayBuffer );
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
    this.setTypedArrays();
  }

  public encodeValues<T>( values: T[], encode: ( element: T, encoder: ByteEncoder ) => void ): this {
    for ( let i = 0; i < values.length; i++ ) {
      encode( values[ i ], this );
    }

    // allow chaining
    return this;
  }

  // TODO: Note the stride of each value might be larger, based on the alignment of the type for WGSL
  public decodeValues<T>( decode: ( encoder: ByteEncoder, offset: number ) => T, bytesPerElement: number ): T[] {
    const result: T[] = [];
    const numElements = Math.floor( this.byteLength / bytesPerElement );
    for ( let i = 0; i < numElements; i++ ) {
      result.push( decode( this, i * bytesPerElement / 4 ) );
    }
    return result;
  }

  public static padLeft( input: string, padding: string, length: number ): string {
    let result = input;

    const padLength = length - input.length;
    for ( let i = 0; i < padLength; i++ ) {
      result = padding + result;
    }

    return result;
  }

  public static padRight( input: string, padding: string, length: number ): string {
    let result = input;

    const padLength = length - input.length;
    for ( let i = 0; i < padLength; i++ ) {
      result = result + padding;
    }

    return result;
  }

  public static toU32Hex( n: number ): string {
    return ByteEncoder.padLeft( n.toString( 16 ), '.', 8 );
  }

  public static toU32Binary( n: number ): string {
    return ByteEncoder.padLeft( n.toString( 2 ), '0', 32 );
  }

  // A safer right-shift that handles negative and out-of-range values
  public static rightShiftU32( n: number, shift: number ): number {
    if ( shift >= 32 ) {
      return 0;
    }
    else if ( shift >= 0 ) {
      return n >>> shift;
    }
    else if ( shift >= -31 ) {
      return ( n << -shift ) >>> 0;
    }
    else {
      return 0;
    }
  }

  public getDebug32String(): string {
    const u32Array = this.u32Array;
    const i32Array = this.i32Array;
    const f32Array = this.f32Array;

    const u32Size = Math.max( ...u32Array.map( s => ( '' + s ).length ) );
    const i32Size = Math.max( ...i32Array.map( s => ( '' + s ).length ) );
    const f32Size = Math.max( ...f32Array.map( s => ( '' + s ).length ) );
    const indexSize = ( '' + ( u32Array.length - 1 ) ).length;
    const hexIndexSize = ( '' + ( u32Array.length - 1 ).toString( 16 ) ).length;

    let result = '';
    result += `${ByteEncoder.padLeft( 'i', ' ', indexSize )} ${ByteEncoder.padLeft( 'i', ' ', hexIndexSize )} ${ByteEncoder.padLeft( 'binary', ' ', 32 )} ${ByteEncoder.padLeft( 'hex', ' ', 8 )} ${ByteEncoder.padLeft( 'i32', ' ', i32Size )} ${ByteEncoder.padLeft( 'u32', ' ', u32Size )} ${ByteEncoder.padRight( 'f32', ' ', f32Size )}\n`;
    for ( let i = 0; i < u32Array.length; i++ ) {
      const u32 = u32Array[ i ];
      const i32 = i32Array[ i ];
      const f32 = f32Array[ i ];

      const index = ByteEncoder.padLeft( '' + i, ' ', indexSize );
      const hexIndex = ByteEncoder.padLeft( '' + i.toString( 16 ), ' ', hexIndexSize );
      const hex = ByteEncoder.toU32Hex( u32 );
      const binary = ByteEncoder.toU32Binary( u32 );
      const u32String = ByteEncoder.padLeft( '' + u32, ' ', u32Size );
      const i32String = ByteEncoder.padLeft( '' + i32, ' ', i32Size );
      const f32String = ByteEncoder.padRight( '' + f32, ' ', f32Size );
      result += `${index} ${hexIndex} ${binary} ${hex} ${i32String} ${u32String} ${f32String}\n`;
    }

    return result;
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

  /**
   * Convert i32 to 4 bytes in little endian order
   */
  public static i32ToBytes( int: number ): U8[] {
    const view = new DataView( scratchForBytes.buffer );
    view.setInt32( 0, int );
    return [ ...scratchForBytes ].reverse();
  }

  // TODO: a "maxStripedIndex"?

  /**
   * Converts an index from a normal (blocked) order to a striped order (for improved memory coherence).
   */
  public static toStripedIndex( blockedIndex: number, workgroupSize: number, grainSize: number ): number {

    // return ( Math.floor( blockedIndex / ( workgroupSize * grainSize ) ) * grainSize + blockedIndex % grainSize ) * workgroupSize +
    //        Math.floor( blockedIndex % ( workgroupSize * grainSize ) / grainSize );

    const localIndex = blockedIndex % ( workgroupSize * grainSize );

    return Math.floor( blockedIndex / ( workgroupSize * grainSize ) ) * workgroupSize * grainSize +
           ( blockedIndex % grainSize ) * workgroupSize +
           Math.floor( localIndex / grainSize );
  }

  /**
   * Converts an index from a striped order to a normal (blocked) order.
   */
  public static fromStripedIndex( stripedIndex: number, workgroupSize: number, grainSize: number ): number {
    const localIndex = stripedIndex % ( workgroupSize * grainSize );

    return Math.floor( stripedIndex / ( workgroupSize * grainSize ) ) * workgroupSize * grainSize +
           ( stripedIndex % workgroupSize ) * grainSize +
           Math.floor( localIndex / workgroupSize );
  }

  /**
   * Converts to/from convergent indices (and handles the modulo-size portion)
   */
  public static getConvergentIndex( index: number, size: number ): number {
    const bits = Math.log2( size );
    assert && assert( Number.isInteger( bits ) );

    let result = 0;

    for ( let bit = 0; bit < 32; bit++ ) {
      if ( ( index & ( 1 << bit ) ) !== 0 ) {
        if ( bit < bits ) {
          result |= ( 1 << ( bits - bit - 1 ) );
        }
        else {
          result |= ( 1 << bit );
        }
      }
    }

    return result >>> 0; // convert to unsigned
  }

  /**
   * Co-rank function, that determines the indices into two arrays that would be at a given rank if they were sorted
   * together (with a binary search).
   *
   * It will return the index into the first array (A), and the index into the second array (B) would just be
   * k - result.
   *
   * For example, if we have two arrays:
   *
   * const a = [ 0, 5, 7, 7, 10, 11, 15, 16, 16, 16, 17 ];
   * const b = [ 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13 ];
   *
   * and define our co-rank function:
   * const get = k => phet.alpenglow.ByteEncoder.getCorank( k, a.length, b.length, ( i, j ) => a[ i ] - b[ j ] );
   *
   * The following will return a sorted array of the values from both arrays:
   *
   * _.range( 0, a.length + b.length ).map( k => {
   *   if ( get( k ) !== get( k + 1 ) ) {
   *     return a[ get( k ) ];
   *   } else {
   *     return b[ k - get( k ) ]
   *   }
   * } );
   * // [0, 1, 2, 5, 5, 6, 7, 7, 7, 8, 9, 10, 10, 11, 11, 12, 13, 15, 16, 16, 16, 17]
   *
   * @param k
   * @param m
   * @param n
   * @param compare
   */
  public static getCorank( k: number, m: number, n: number, compare: ( aIndex: number, bIndex: number ) => number ): number {
    let i = Math.min( k, m );
    let j = k - i;
    let iLow = Math.max( 0, k - n );
    let jLow = Math.max( 0, k - m );
    let delta;
    while ( true ) {
      if ( i > 0 && j < n && compare( i - 1, j ) > 0 ) {
        delta = ( i - iLow + 1 ) >> 1;
        jLow = j;
        j = j + delta;
        i = i - delta;
      }
      else if ( j > 0 && i < m && compare( i, j - 1 ) <= 0 ) {
        delta = ( j - jLow + 1 ) >> 1;
        iLow = i;
        i = i + delta;
        j = j - delta;
      }
      else {
        break;
      }
    }
    return i;
  }
}

alpenglow.register( 'ByteEncoder', ByteEncoder );