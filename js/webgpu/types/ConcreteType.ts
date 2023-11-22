// Copyright 2023, University of Colorado Boulder

/**
 * Represents a data type that can be serialized/deserialized to/from a binary form, both in TypeScript and in WGSL.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ByteEncoder, u32 } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';
import Random from '../../../../dot/js/Random.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

type ConcreteType<T> = {
  bytesPerElement: number;

  // Encodes a given value into the end of the encoder
  encode( value: T, encoder: ByteEncoder ): void;

  // Reads a value starting at the given offset (in u32s) from the encoder
  decode( encoder: ByteEncoder, offset: number ): T;

  // WGSL representation
  valueType: string;
  writeU32s(
    // given an expr:u32 offset and expr:u32 value, it will store the value at the offset
    storeStatement: ( offset: string, u32: string ) => string,

    // the variable name (e.g. expr:T) that is being stored
    value: string
  ): string;

  // Helper for testing
  generateRandom( fullSize?: boolean ): T;

  getDebugString( value: T ): string;

  // TODO: reading? (e.g. from structure-of-arrays, but also from just... other types and generic u32 buffers?)
};

export default ConcreteType;

export type BinaryOp<T> = {
  type: ConcreteType<T>;
  isCommutative: boolean;

  // TS
  apply: ( a: T, b: T ) => T;

  // WGSL
  identity: string;
  combineExpression?: ( a: string, b: string ) => string;
  combineStatements?: ( varName: string, a: string, b: string ) => string;
  atomicName?: string;
};

export type RadixComparable<T> = {
  type: ConcreteType<T>;

  // TS
  getBits: ( value: T, bitOffset: number, bitQuantity: number ) => number;

  // WGSL
  getBitsWGSL: ( value: string, bitOffset: number, bitQuantity: number ) => string;
};

export type Comparable<T> = {
  type: ConcreteType<T>;

  // TS
  equals: ( a: T, b: T ) => boolean;
  compare: ( a: T, b: T ) => number;

  // WGSL
  // ( a: expr:T, b: expr:T ) => expr:bool
  equalsWGSL: ( a: string, b: string ) => string;
  // ( a: expr:T, b: expr:T ) => expr:i32
  compareWGSL: ( a: string, b: string ) => string;
  // ( a: expr:T, b: expr:T ) => expr:bool
  greaterThan: ( a: string, b: string ) => string;
  // ( a: expr:T, b: expr:T ) => expr:bool
  lessThanOrEqual: ( a: string, b: string ) => string;
};

export const U32Type: ConcreteType<number> = {
  bytesPerElement: 4,

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushU32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullU32Array[ offset ];
  },

  valueType: 'u32',
  writeU32s( storeStatement: ( offset: string, u32: string ) => string, value: string ): string {
    return `
       ${storeStatement( '0u', value )}
    `;
  },

  generateRandom: ( fullSize = false ) => random.nextIntBetween( 0, fullSize ? 0xffffffff : 0xff ),

  getDebugString: ( value: number ) => value.toString()
};

export const U32Add: BinaryOp<number> = {
  type: U32Type,
  isCommutative: true,

  apply: ( a: number, b: number ): number => a + b,

  identity: '0u',
  combineExpression: ( a: string, b: string ) => `( ${a} + ${b} )`,
  combineStatements: ( varName: string, a: string, b: string ) => `${varName} = ${a} + ${b};`,
  atomicName: 'atomicAdd'
};

export const U32Order: ( RadixComparable<number> & Comparable<number> ) = {
  type: U32Type,

  equals( a: number, b: number ): boolean {
    return a === b;
  },

  compare( a: number, b: number ): number {
    return a - b;
  },

  getBits: ( value: number, bitOffset: number, bitQuantity: number ): number => {
    return ( ( value >>> bitOffset ) & ( ( 1 << bitQuantity ) - 1 ) ) >>> 0;
  },

  equalsWGSL: ( a: string, b: string ): string => {
    return `( ${a} == ${b} )`;
  },

  compareWGSL: ( a: string, b: string ): string => {
    // TODO: THIS FAILS RANGE CHECKS
    // return `( i32( ${a} ) - i32( ${b} ) )`;

    return `select( -1i, select( 0i, 1i, ${a} > ${b} ), ${a} < ${b} )`;
  },

  greaterThan: ( a: string, b: string ): string => {
    return `( ${a} > ${b} )`;
  },

  lessThanOrEqual: ( a: string, b: string ): string => {
    return `( ${a} <= ${b} )`;
  },

  getBitsWGSL: ( value: string, bitOffset: number, bitQuantity: number ): string => {
    return `( ( ${value} >> ${u32( bitOffset )} ) & ${u32( ( 1 << bitQuantity ) - 1 )} )`;
  }
};

// TODO: add other atomic typesf

export const I32Type: ConcreteType<number> = {
  bytesPerElement: 4,

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushI32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullI32Array[ offset ];
  },

  valueType: 'i32',
  writeU32s( storeStatement: ( offset: string, u32: string ) => string, value: string ): string {
    return `
       ${storeStatement( '0u', `bitcast<u32>( ${value} )` )}
    `;
  },

  generateRandom: ( fullSize = false ) => random.nextIntBetween( 0, fullSize ? -0x7fffffff : -0x7f, fullSize ? 0x7fffffff : 0x7f ),

  getDebugString: ( value: number ) => value.toString()
};

export const Vec2uType: ConcreteType<Vector2> = {
  bytesPerElement: 8,

  encode( value: Vector2, encoder: ByteEncoder ): void {
    encoder.pushU32( value.x );
    encoder.pushU32( value.y );
  },
  decode( encoder: ByteEncoder, offset: number ): Vector2 {
    return new Vector2( encoder.fullU32Array[ offset ], encoder.fullU32Array[ offset + 1 ] );
  },

  valueType: 'vec2u',
  writeU32s( storeStatement: ( offset: string, u32: string ) => string, value: string ): string {
    return `
       ${storeStatement( '0u', `${value}.x` )}
       ${storeStatement( '1u', `${value}.y` )}
    `;
  },

  generateRandom: ( fullSize = false ) => new Vector2(
    U32Type.generateRandom( fullSize ),
    U32Type.generateRandom( fullSize )
  ),

  getDebugString: ( value: Vector2 ) => `vec2u(${value.x}, ${value.y})`
};

export const Vec2uBic: BinaryOp<Vector2> = {
  type: Vec2uType,
  isCommutative: false,

  apply: ( a: Vector2, b: Vector2 ): Vector2 => {
    const min = Math.min( a.y, b.x );
    return new Vector2(
      a.x + b.x - min,
      a.y + b.y - min
    );
  },

  identity: 'vec2( 0u )',
  combineExpression: ( a: string, b: string ) => `( ${a} + ${b} - min( ${a}.y, ${b}.x ) )`,
  combineStatements: ( varName: string, a: string, b: string ) => `${varName} = ${a} + ${b} - min( ${a}.y, ${b}.x );`
};
