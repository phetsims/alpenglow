// Copyright 2023, University of Colorado Boulder

/**
 * Represents a data type that can be serialized/deserialized to/from a binary form, both in TypeScript and in WGSL.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ByteEncoder, u32, PipelineBlueprint } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';
import Random from '../../../../dot/js/Random.js';
import Vector3 from '../../../../dot/js/Vector3.js';
import Vector4 from '../../../../dot/js/Vector4.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

export type WGSLExpression = string;
export type WGSLExpressionU32 = WGSLExpression;
export type WGSLExpressionI32 = WGSLExpression;
export type WGSLExpressionBool = WGSLExpression;
export type WGSLExpressionT = WGSLExpression; // For use when we have a generic type
export type WGSLStatements = string;
export type WGSLModuleDeclarations = string;
export type WGSLVariableName = string;
export type WGSLBinaryExpression = ( a: WGSLExpression, b: WGSLExpression ) => WGSLExpression;
export type WGSLBinaryStatements = ( value: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => WGSLStatements;

type StoreStatementCallback = ( offset: WGSLExpressionU32, u32expr: WGSLExpressionU32 ) => WGSLStatements;

type ConcreteType<T = unknown> = {
  name: string;

  // TODO: deduplicate with wgslSize/wgslAlign. This is the size of the ENTIRE type, drop the "element" bit
  bytesPerElement: number;

  // TS
  equals: ( a: T, b: T ) => boolean;

  // WGSL TODO: allow statements
  equalsWGSL: ( blueprint: PipelineBlueprint, a: WGSLExpressionT, b: WGSLExpressionT ) => WGSLExpressionBool;

  // Encodes a given value into the end of the encoder
  encode( value: T, encoder: ByteEncoder ): void;

  // Reads a value starting at the given offset (in u32s) from the encoder
  decode( encoder: ByteEncoder, offset: number ): T;

  // WGSL representation
  // TODO: consider rename to getValueType?
  valueType: ( blueprint: PipelineBlueprint ) => string;
  writeU32s(
    // given an expr:u32 offset and expr:u32 value, it will store the value at the offset
    storeStatement: StoreStatementCallback,

    // the variable name (e.g. expr:T) that is being stored
    value: WGSLExpression
  ): WGSLStatements;

  // See https://www.w3.org/TR/WGSL/#alignment-and-size
  wgslAlign: number;
  wgslSize: number; // TODO: how to represent variable-length items?

  // Helper for testing
  generateRandom( fullSize?: boolean ): T;

  toDebugString( value: T ): string;

  // TODO: reading? (e.g. from structure-of-arrays, but also from just... other types and generic u32 buffers?)
};
export default ConcreteType;

// TODO: potential separation of "WGSLType" - and the way to read the "raw" data out, is different than ConcreteType (which includes the JS representation)

// From the WGSL spec, https://www.w3.org/TR/WGSL/#roundup
const roundUp = ( k: number, n: number ) => Math.ceil( n / k ) * k;
// const strideOfArrayOf = ( elementType: ConcreteType ): number => roundUp( elementType.wgslAlign, elementType.wgslSize );

// TODO: Have ConcreteType and things be classes? The Array type should contain more info, etc. But we also want to
// TODO: allow full flexibility...? Structure types we'll want to get things out of.

export type ConcreteArrayType<T = unknown> = ConcreteType<T[]> & {
  elementType: ConcreteType<T>;
  length: number;
  slice( start: number, end: number ): ConcreteArrayType<T>;
};

export type BinaryOp<T> = {
  name: string;
  type: ConcreteType<T>;
  isCommutative: boolean;

  // TS
  identity: T;
  apply: ( a: T, b: T ) => T;

  // WGSL
  identityWGSL: string;
  combineExpression?: ( a: string, b: string ) => string;
  combineStatements?: ( varName: string, a: string, b: string ) => string;
  atomicName?: string;
};

export type BitOrder<T> = {
  name: string;
  type: ConcreteType<T>;

  // TS
  getBits: ( value: T, bitOffset: number, bitQuantity: number ) => number;

  // WGSL TODO support statements(!) --- or do we need that? Could use function-call overhead
  getBitsWGSL: ( value: WGSLExpressionT, bitOffset: number, bitQuantity: number ) => WGSLExpressionU32;
};

export type CompareOrder<T> = {
  name: string;
  type: ConcreteType<T>;

  // TS
  compare: ( a: T, b: T ) => number;

  // WGSL
  // ( a: expr:T, b: expr:T ) => expr:i32
  compareWGSL: ( a: string, b: string ) => string;
  // ( a: expr:T, b: expr:T ) => expr:bool
  greaterThan: ( a: string, b: string ) => string;
  // ( a: expr:T, b: expr:T ) => expr:bool
  lessThanOrEqual: ( a: string, b: string ) => string;
};

export type Order<T> = BitOrder<T> & CompareOrder<T>;

export const getArrayType = <T>( type: ConcreteType<T>, size: number, outOfRangeElement?: T ): ConcreteArrayType<T> => {
  const u32sPerElement = type.bytesPerElement / 4;

  return {
    name: `${type.name}[${size}]`,
    bytesPerElement: type.bytesPerElement * size,
    length: size,

    elementType: type,

    slice( start: number, end: number ): ConcreteArrayType<T> {
      assert && assert( start === 0, 'We will need more logic to handle offsets' );

      return getArrayType( type, end, outOfRangeElement );
    },

    equals( a: T[], b: T[] ): boolean {
      assert && assert( a.length === size );
      assert && assert( b.length === size );

      for ( let i = 0; i < size; i++ ) {
        if ( !type.equals( a[ i ], b[ i ] ) ) {
          return false;
        }
      }

      return true;
    },

    equalsWGSL( blueprint: PipelineBlueprint, a: string, b: string ): string {
      return `( ${_.range( 0, size ).map( i => {
        return type.equalsWGSL( blueprint, `${a}[ ${u32( i )} ]`, `${b}[ ${u32( i )} ]` );
      } ).join( ' && ' )} )`;
    },

    encode( value: T[], encoder: ByteEncoder ): void {
      assert && assert( outOfRangeElement !== undefined || value.length === size );

      for ( let i = 0; i < size; i++ ) {
        type.encode( i < value.length ? value[ i ] : outOfRangeElement!, encoder );
      }
    },

    decode( encoder: ByteEncoder, offset: number ): T[] {
      const array: T[] = [];

      for ( let i = 0; i < size; i++ ) {
        array.push( type.decode( encoder, offset + i * u32sPerElement ) );
      }

      return array;
    },

    valueType: ( blueprint: PipelineBlueprint ) => `array<${type.valueType( blueprint )}, ${size}>`,
    writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
      return _.range( 0, size ).map( i => {
        return type.writeU32s(
          ( offset, u32expr ) => storeStatement( `( ${offset} + ${u32( i * u32sPerElement )} )`, u32expr ),
          `${value}[ ${u32( i )} ]`
        );
      } ).join( '\n' );
    },

    wgslAlign: type.wgslAlign,
    wgslSize: size * roundUp( type.wgslAlign, type.wgslSize ),

    generateRandom( fullSize = false ): T[] {
      return _.range( 0, size ).map( () => type.generateRandom( fullSize ) );
    },

    toDebugString( value: T[] ): string {
      return `[${value.map( v => type.toDebugString( v ) ).join( ', ' )}]`;
    }
  };
};
alpenglow.register( 'getArrayType', getArrayType );

export const getCastedType = <T>( type: ConcreteType<T>, valueType: ( blueprint: PipelineBlueprint ) => string ): ConcreteType<T> => {
  return {
    // eslint-disable-next-line no-object-spread-on-non-literals
    ...type,
    valueType: valueType
  };
};

export const U32Type: ConcreteType<number> = {
  name: 'u32',
  bytesPerElement: 4,

  equals( a: number, b: number ): boolean {
    return a === b;
  },

  equalsWGSL: ( blueprint: PipelineBlueprint, a: string, b: string ): string => {
    return `( ${a} == ${b} )`;
  },

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushU32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullU32Array[ offset ];
  },

  valueType: () => 'u32',
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return `
       ${storeStatement( '0u', value )}
    `;
  },
  wgslAlign: 4,
  wgslSize: 4,

  generateRandom: ( fullSize = false ) => random.nextIntBetween( 0, fullSize ? 0xffffffff : 0xff ),

  toDebugString: ( value: number ) => value.toString()
};
alpenglow.register( 'U32Type', U32Type );

export const U32AtomicType: ConcreteType<number> = {
  name: 'u32 atomic',
  bytesPerElement: 4,

  equals( a: number, b: number ): boolean {
    return a === b;
  },

  equalsWGSL: ( blueprint: PipelineBlueprint, a: string, b: string ): string => {
    return `( atomicLoad( &${a} ) == atomicLoad( &${b} ) )`;
  },

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushU32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullU32Array[ offset ];
  },

  valueType: () => 'atomic<u32>',
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return `
       ${storeStatement( '0u', `atomicLoad( &${value} )` )}
    `;
  },
  wgslAlign: 4,
  wgslSize: 4,

  generateRandom: ( fullSize = false ) => random.nextIntBetween( 0, fullSize ? 0xffffffff : 0xff ),

  toDebugString: ( value: number ) => value.toString()
};
alpenglow.register( 'U32AtomicType', U32AtomicType );

export const U32Add: BinaryOp<number> = {
  name: 'u32 addition',
  type: U32Type,
  isCommutative: true,

  identity: 0,
  apply: ( a: number, b: number ): number => a + b,

  identityWGSL: '0u',
  combineExpression: ( a: string, b: string ) => `( ${a} + ${b} )`,
  combineStatements: ( varName: string, a: string, b: string ) => `${varName} = ${a} + ${b};`,
  atomicName: 'atomicAdd'
};
// TODO: add other atomic types (and specifically atomic types)
alpenglow.register( 'U32Add', U32Add );

export const U32Order: Order<number> = {
  name: 'u32 order',
  type: U32Type,

  compare( a: number, b: number ): number {
    return a - b;
  },

  getBits: ( value: number, bitOffset: number, bitQuantity: number ): number => {
    return ( ( value >>> bitOffset ) & ( ( 1 << bitQuantity ) - 1 ) ) >>> 0;
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
alpenglow.register( 'U32Order', U32Order );

export const U32ReverseOrder: Order<number> = {
  name: 'u32 reverse order',
  type: U32Type,

  compare( a: number, b: number ): number {
    return b - a;
  },

  getBits: ( value: number, bitOffset: number, bitQuantity: number ): number => {
    return ( ( ( 0xffffffff - value ) >>> bitOffset ) & ( ( 1 << bitQuantity ) - 1 ) ) >>> 0;
  },

  compareWGSL: ( a: string, b: string ): string => {
    return `select( -1i, select( 0i, 1i, ${a} < ${b} ), ${a} > ${b} )`;
  },

  greaterThan: ( a: string, b: string ): string => {
    return `( ${a} < ${b} )`;
  },

  lessThanOrEqual: ( a: string, b: string ): string => {
    return `( ${a} >= ${b} )`;
  },

  getBitsWGSL: ( value: string, bitOffset: number, bitQuantity: number ): string => {
    // TODO: is there a bitwise trick?
    return `( ( ( 0xffffffffu - ${value} ) >> ${u32( bitOffset )} ) & ${u32( ( 1 << bitQuantity ) - 1 )} )`;
  }
};
alpenglow.register( 'U32ReverseOrder', U32ReverseOrder );

export const I32Type: ConcreteType<number> = {
  name: 'i32',
  bytesPerElement: 4,

  equals( a: number, b: number ): boolean {
    return a === b;
  },

  equalsWGSL: ( blueprint: PipelineBlueprint, a: string, b: string ): string => {
    return `( ${a} == ${b} )`;
  },

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushI32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullI32Array[ offset ];
  },

  valueType: () => 'i32',
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return `
       ${storeStatement( '0u', `bitcast<u32>( ${value} )` )}
    `;
  },
  wgslAlign: 4,
  wgslSize: 4,

  generateRandom: ( fullSize = false ) => random.nextIntBetween( fullSize ? -0x7fffffff : -0x7f, fullSize ? 0x7fffffff : 0x7f ),

  toDebugString: ( value: number ) => value.toString()
};
alpenglow.register( 'I32Type', I32Type );

export const I32AtomicType: ConcreteType<number> = {
  name: 'i32 atomic',
  bytesPerElement: 4,

  equals( a: number, b: number ): boolean {
    return a === b;
  },

  equalsWGSL: ( blueprint: PipelineBlueprint, a: string, b: string ): string => {
    return `( atomicLoad( &${a} ) == atomicLoad( &${b} ) )`;
  },

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushU32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullU32Array[ offset ];
  },

  valueType: () => 'atomic<i32>',
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return `
       ${storeStatement( '0u', `bitcast<u32>( atomicLoad( &${value} ) )` )}
    `;
  },
  wgslAlign: 4,
  wgslSize: 4,

  generateRandom: ( fullSize = false ) => random.nextIntBetween( fullSize ? -0x7fffffff : -0x7f, fullSize ? 0x7fffffff : 0x7f ),

  toDebugString: ( value: number ) => value.toString()
};
alpenglow.register( 'I32AtomicType', I32AtomicType );

export const I32Add: BinaryOp<number> = {
  name: 'i32 addition',
  type: I32Type,
  isCommutative: true,

  identity: 0,
  apply: ( a: number, b: number ): number => a + b,

  identityWGSL: '0i',
  combineExpression: ( a: string, b: string ) => `( ${a} + ${b} )`,
  combineStatements: ( varName: string, a: string, b: string ) => `${varName} = ${a} + ${b};`,
  atomicName: 'atomicAdd'
};
// TODO: add other atomic types (and specifically atomic types)
alpenglow.register( 'I32Add', I32Add );

export const Vec2uType: ConcreteType<Vector2> = {
  name: 'vec2u',
  bytesPerElement: 8,

  equals( a: Vector2, b: Vector2 ): boolean {
    return a.equals( b );
  },

  equalsWGSL: ( blueprint: PipelineBlueprint, a: string, b: string ): string => {
    // TODO: test
    return `all( ${a} == ${b} )`;
  },

  encode( value: Vector2, encoder: ByteEncoder ): void {
    encoder.pushU32( value.x );
    encoder.pushU32( value.y );
  },
  decode( encoder: ByteEncoder, offset: number ): Vector2 {
    return new Vector2( encoder.fullU32Array[ offset ], encoder.fullU32Array[ offset + 1 ] );
  },

  valueType: () => 'vec2u',
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return `
       ${storeStatement( '0u', `${value}.x` )}
       ${storeStatement( '1u', `${value}.y` )}
    `;
  },
  wgslAlign: 8,
  wgslSize: 8,

  generateRandom: ( fullSize = false ) => new Vector2(
    U32Type.generateRandom( fullSize ),
    U32Type.generateRandom( fullSize )
  ),

  toDebugString: ( value: Vector2 ) => `vec2u(${value.x}, ${value.y})`
};
alpenglow.register( 'Vec2uType', Vec2uType );

export const Vec2uAdd: BinaryOp<Vector2> = {
  name: 'vec2u addition',
  type: Vec2uType,
  isCommutative: true,

  identity: Vector2.ZERO,
  apply: ( a: Vector2, b: Vector2 ): Vector2 => a.plus( b ),

  identityWGSL: 'vec2u()',
  combineExpression: ( a: string, b: string ) => `( ${a} + ${b} )`,
  combineStatements: ( varName: string, a: string, b: string ) => `${varName} = ${a} + ${b};`
};
alpenglow.register( 'Vec2uAdd', Vec2uAdd );

export const Vec2uBic: BinaryOp<Vector2> = {
  name: 'vec2u bicyclic semigroup',
  type: Vec2uType,
  isCommutative: false,

  identity: Vector2.ZERO,
  apply: ( a: Vector2, b: Vector2 ): Vector2 => {
    const min = Math.min( a.y, b.x );
    return new Vector2(
      a.x + b.x - min,
      a.y + b.y - min
    );
  },

  identityWGSL: 'vec2( 0u )',
  combineExpression: ( a: string, b: string ) => `( ${a} + ${b} - min( ${a}.y, ${b}.x ) )`,
  combineStatements: ( varName: string, a: string, b: string ) => `${varName} = ${a} + ${b} - min( ${a}.y, ${b}.x );`
};
alpenglow.register( 'Vec2uBic', Vec2uBic );

export const Vec2uLexicographicalOrder: Order<Vector2> = {
  name: 'vec2u lexicographical order',
  type: Vec2uType,

  compare( a: Vector2, b: Vector2 ): number {
    const xOrder = U32Order.compare( a.x, b.x );
    if ( xOrder !== 0 ) {
      return xOrder;
    }
    else {
      return U32Order.compare( a.y, b.y );
    }
  },

  getBits: ( value: Vector2, bitOffset: number, bitQuantity: number ): number => {
    return ( ( ByteEncoder.rightShiftU32( value.x, bitOffset - 32 ) & ( ( 1 << bitQuantity ) - 1 ) ) >>> 0 ) +
           ( ( ByteEncoder.rightShiftU32( value.y, bitOffset ) & ( ( 1 << bitQuantity ) - 1 ) ) >>> 0 );
  },

  // TODO: support statements
  compareWGSL: ( a: string, b: string ): string => {
    return `select( -1i, select( select( -1i, select( 0i, 1i, ${a}.y > ${b}.y ), ${a}.y < ${b}.y ), 1i, ${a}.x > ${b}.x ), ${a}.x < ${b}.x )`;
  },

  greaterThan: ( a: string, b: string ): string => {
    return `( ${a}.x > ${b}.x || ( ${a}.x == ${b}.x && ${a}.y > ${b}.y ) )`;
  },

  lessThanOrEqual: ( a: string, b: string ): string => {
    return `( ${a}.x <= ${b}.x && ( ${a}.x != ${b}.x || ${a}.y <= ${b}.y ) )`;
  },

  getBitsWGSL: ( value: string, bitOffset: number, bitQuantity: number ): string => {
    // NOTE: WGSL doesn't like `<< 32u`, so we split it like so.
    if ( bitOffset === 0 ) {
      return `( ( ${value}.y >> ${u32( bitOffset )} ) & ${u32( ( 1 << bitQuantity ) - 1 )} )`;
    }
    else if ( bitOffset < 32 ) {
      return `( ( ( ${value}.x << ${u32( 32 - bitOffset )} ) & ${u32( ( 1 << bitQuantity ) - 1 )} ) | ( ( ${value}.y >> ${u32( bitOffset )} ) & ${u32( ( 1 << bitQuantity ) - 1 )} ) )`;
    }
    else {
      return `( ( ${value}.x >> ${u32( bitOffset - 32 )} ) & ${u32( ( 1 << bitQuantity ) - 1 )} )`;
    }
  }
};
alpenglow.register( 'Vec2uLexicographicalOrder', Vec2uLexicographicalOrder );

export const Vec3uType: ConcreteType<Vector3> = {
  name: 'vec3u',
  bytesPerElement: 12,

  equals( a: Vector3, b: Vector3 ): boolean {
    return a.equals( b );
  },

  equalsWGSL: ( blueprint: PipelineBlueprint, a: string, b: string ): string => {
    // TODO: test
    return `all( ${a} == ${b} )`;
  },

  encode( value: Vector3, encoder: ByteEncoder ): void {
    encoder.pushU32( value.x );
    encoder.pushU32( value.y );
    encoder.pushU32( value.z );
  },
  decode( encoder: ByteEncoder, offset: number ): Vector3 {
    return new Vector3( encoder.fullU32Array[ offset ], encoder.fullU32Array[ offset + 1 ], encoder.fullU32Array[ offset + 2 ] );
  },

  valueType: () => 'vec3u',
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return `
       ${storeStatement( '0u', `${value}.x` )}
       ${storeStatement( '1u', `${value}.y` )}
       ${storeStatement( '2u', `${value}.z` )}
    `;
  },
  wgslAlign: 16,
  wgslSize: 12,

  generateRandom: ( fullSize = false ) => new Vector3(
    U32Type.generateRandom( fullSize ),
    U32Type.generateRandom( fullSize ),
    U32Type.generateRandom( fullSize )
  ),

  toDebugString: ( value: Vector3 ) => `vec3u(${value.x}, ${value.y}, ${value.z})`
};
alpenglow.register( 'Vec3uType', Vec3uType );

export const Vec3uAdd: BinaryOp<Vector3> = {
  name: 'vec3u addition',
  type: Vec3uType,
  isCommutative: true,

  identity: Vector3.ZERO,
  apply: ( a: Vector3, b: Vector3 ): Vector3 => a.plus( b ),

  identityWGSL: 'vec3u()',
  combineExpression: ( a: string, b: string ) => `( ${a} + ${b} )`,
  combineStatements: ( varName: string, a: string, b: string ) => `${varName} = ${a} + ${b};`
};
alpenglow.register( 'Vec3uAdd', Vec3uAdd );

export const Vec4uType: ConcreteType<Vector4> = {
  name: 'vec4u',
  bytesPerElement: 16,

  equals( a: Vector4, b: Vector4 ): boolean {
    return a.equals( b );
  },

  equalsWGSL: ( blueprint: PipelineBlueprint, a: string, b: string ): string => {
    // TODO: test
    return `all( ${a} == ${b} )`;
  },

  encode( value: Vector4, encoder: ByteEncoder ): void {
    encoder.pushU32( value.x );
    encoder.pushU32( value.y );
    encoder.pushU32( value.z );
    encoder.pushU32( value.w );
  },
  decode( encoder: ByteEncoder, offset: number ): Vector4 {
    return new Vector4( encoder.fullU32Array[ offset ], encoder.fullU32Array[ offset + 1 ], encoder.fullU32Array[ offset + 2 ], encoder.fullU32Array[ offset + 3 ] );
  },

  valueType: () => 'vec4u',
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return `
       ${storeStatement( '0u', `${value}.x` )}
       ${storeStatement( '1u', `${value}.y` )}
       ${storeStatement( '2u', `${value}.z` )}
       ${storeStatement( '3u', `${value}.w` )}
    `;
  },

  wgslAlign: 16,
  wgslSize: 16,

  generateRandom: ( fullSize = false ) => new Vector4(
    U32Type.generateRandom( fullSize ),
    U32Type.generateRandom( fullSize ),
    U32Type.generateRandom( fullSize ),
    U32Type.generateRandom( fullSize )
  ),

  toDebugString: ( value: Vector4 ) => `vec4u(${value.x}, ${value.y}, ${value.z}, ${value.w})`
};
alpenglow.register( 'Vec4uType', Vec4uType );

export const Vec4uAdd: BinaryOp<Vector4> = {
  name: 'vec4u addition',
  type: Vec4uType,
  isCommutative: true,

  identity: Vector4.ZERO,
  apply: ( a: Vector4, b: Vector4 ): Vector4 => a.plus( b ),

  identityWGSL: 'vec4u()',
  combineExpression: ( a: string, b: string ) => `( ${a} + ${b} )`,
  combineStatements: ( varName: string, a: string, b: string ) => `${varName} = ${a} + ${b};`
};
alpenglow.register( 'Vec4uAdd', Vec4uAdd );
