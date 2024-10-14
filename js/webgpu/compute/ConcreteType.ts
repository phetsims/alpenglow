// Copyright 2023-2024, University of Colorado Boulder

/**
 * Represents a data type that can be serialized/deserialized to/from a binary form, both in TypeScript and in WGSL.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ByteEncoder, decimalS, i32S, u32S, wgsl, WGSLExpression, WGSLExpressionBool, WGSLExpressionI32, WGSLExpressionT, WGSLExpressionU32, wgslJoin, WGSLStatements, WGSLType, WGSLVariableName } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';
import Random from '../../../../dot/js/Random.js';
import Vector3 from '../../../../dot/js/Vector3.js';
import Vector4 from '../../../../dot/js/Vector4.js';

// eslint-disable-next-line phet/bad-sim-text
const random = new Random();

export type WGSLBinaryStatements = ( value: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => WGSLStatements;

export type StoreStatementCallback = ( offset: WGSLExpressionU32, u32expr: WGSLExpressionU32 ) => WGSLStatements;

type ConcreteType<T = unknown> = {
  name: string;

  // TODO: deduplicate with wgslSize/wgslAlign. This is the size of the ENTIRE type, drop the "element" bit
  bytesPerElement: number;

  outOfRangeElement?: T;

  // TS
  equals: ( a: T, b: T ) => boolean;

  // WGSL
  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ) => WGSLExpressionBool;

  // Encodes a given value into the end of the encoder
  encode( value: T, encoder: ByteEncoder ): void;

  // Reads a value starting at the given offset (in u32s) from the encoder
  decode( encoder: ByteEncoder, offset: number ): T;

  // WGSL representation
  // TODO: consider rename to valueTypeWGSL?
  valueType: WGSLType;
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

export const U32_IDENTITY_VALUES = {
  add: 0,
  max: 0,
  min: 0xffffffff,
  and: 0xffffffff,
  or: 0,
  xor: 0
} as const;

// TODO: double-check some of these
export const I32_IDENTITY_VALUES = {
  add: 0,
  // max: -0x80000000, // what, why can't this be represented?
  max: -0x7fffffff,
  min: 0x7fffffff,
  and: -1,
  or: 0,
  xor: 0
} as const;

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
  identityWGSL: WGSLExpressionT;
  combineExpression?: ( a: WGSLExpressionT, b: WGSLExpressionT ) => WGSLExpressionT;

  // TODO: Don't have this, if needed just rely on a function placed on the blueprint(!)
  // TODO: remove this(!)
  combineStatements?: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => WGSLStatements;
  atomicName?: string;
};

export type BitOrder<T> = {
  name: string;
  type: ConcreteType<T>;

  // TS
  getBits: ( value: T, bitOffset: number, bitQuantity: number ) => number;

  // WGSL
  getBitsWGSL: ( value: WGSLExpressionT, bitOffset: number, bitQuantity: number ) => WGSLExpressionU32;
};

export type CompareOrder<T> = {
  name: string;
  type: ConcreteType<T>;

  // TS
  compare: ( a: T, b: T ) => number;

  // WGSL
  compareWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ) => WGSLExpressionI32;
  greaterThanWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ) => WGSLExpressionBool;
  lessThanOrEqualWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ) => WGSLExpressionBool;
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

    equalsWGSL( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool {
      // TODO: this is excessive... we should just do a loop? I guess we need it as an expression?
      return wgslJoin( ' && ', _.range( 0, size ).map( i => {
        return type.equalsWGSL( wgsl`${a}[ ${u32S( i )} ]`, wgsl`${b}[ ${u32S( i )} ]` );
      } ) );
    },

    encode( value: T[], encoder: ByteEncoder ): void {
      assert && assert( outOfRangeElement !== undefined || type.outOfRangeElement !== undefined || value.length === size );

      for ( let i = 0; i < size; i++ ) {
        type.encode( i < value.length ? value[ i ] : outOfRangeElement === undefined ? type.outOfRangeElement! : outOfRangeElement, encoder );
      }
    },

    decode( encoder: ByteEncoder, offset: number ): T[] {
      const array: T[] = [];

      for ( let i = 0; i < size; i++ ) {
        array.push( type.decode( encoder, offset + i * u32sPerElement ) );
      }

      return array;
    },

    valueType: wgsl`array<${type.valueType}, ${decimalS( size )}>`,
    writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
      return wgslJoin( '\n', _.range( 0, size ).map( i => {
        return type.writeU32s(
          ( offset, u32expr ) => storeStatement( wgsl`( ${offset} + ${u32S( i * u32sPerElement )} )`, u32expr ),
          wgsl`${value}[ ${u32S( i )} ]`
        );
      } ) );
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

export const getVariableLengthArrayType = <T>( type: ConcreteType<T>, maxSize: number, outOfRangeElement?: T ): ConcreteArrayType<T> => {
  const u32sPerElement = type.bytesPerElement / 4;

  return {
    name: `${type.name}[max ${maxSize}]`,
    bytesPerElement: type.bytesPerElement * maxSize, // TODO: don't define?
    length: maxSize, // TODO: don't define?

    elementType: type,

    slice( start: number, end: number ): ConcreteArrayType<T> {
      assert && assert( start === 0, 'We will need more logic to handle offsets' );

      return getVariableLengthArrayType( type, end, outOfRangeElement );
    },

    // TODO: how to handle? this is a mess
    equals( a: T[], b: T[] ): boolean {
      assert && assert( a.length <= maxSize );
      assert && assert( b.length <= maxSize );

      for ( let i = 0; i < maxSize; i++ ) {
        if ( !type.equals( a[ i ], b[ i ] ) ) {
          return false;
        }
      }

      return true;
    },

    equalsWGSL( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool {
      // TODO: this is excessive... we should just do a loop? I guess we need it as an expression?
      return wgslJoin( ' && ', _.range( 0, maxSize ).map( i => {
        return type.equalsWGSL( wgsl`${a}[ ${u32S( i )} ]`, wgsl`${b}[ ${u32S( i )} ]` );
      } ) );
    },

    encode( value: T[], encoder: ByteEncoder ): void {
      assert && assert( outOfRangeElement !== undefined || type.outOfRangeElement !== undefined || value.length <= maxSize );

      for ( let i = 0; i < value.length; i++ ) {
        type.encode( i < value.length ? value[ i ] : outOfRangeElement === undefined ? type.outOfRangeElement! : outOfRangeElement, encoder );
      }
    },

    // TODO: potential manual "length" included?
    decode( encoder: ByteEncoder, offset: number ): T[] {
      const array: T[] = [];

      for ( let i = 0; i < maxSize; i++ ) {
        array.push( type.decode( encoder, offset + i * u32sPerElement ) );
      }

      return array;
    },

    valueType: wgsl`array<${type.valueType}>`,
    writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
      return wgslJoin( '\n', _.range( 0, maxSize ).map( i => {
        return type.writeU32s(
          ( offset, u32expr ) => storeStatement( wgsl`( ${offset} + ${u32S( i * u32sPerElement )} )`, u32expr ),
          wgsl`${value}[ ${u32S( i )} ]`
        );
      } ) );
    },

    wgslAlign: type.wgslAlign,
    wgslSize: maxSize * roundUp( type.wgslAlign, type.wgslSize ),

    generateRandom( fullSize = false ): T[] {
      return _.range( 0, maxSize ).map( () => type.generateRandom( fullSize ) );
    },

    toDebugString( value: T[] ): string {
      return `[${value.map( v => type.toDebugString( v ) ).join( ', ' )}]`;
    }
  };
};
alpenglow.register( 'getVariableLengthArrayType', getVariableLengthArrayType );

export const getCastedType = <T>( type: ConcreteType<T>, valueType: WGSLType ): ConcreteType<T> => {
  return {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...type,
    valueType: valueType
  };
};

export const U32Type: ConcreteType<number> = {
  name: 'u32',
  bytesPerElement: 4,

  outOfRangeElement: 101010101,

  equals( a: number, b: number ): boolean {
    return a === b;
  },

  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} == ${b} )`;
  },

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushU32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullU32Array[ offset ];
  },

  valueType: wgsl`u32`,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, value )}
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

  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( atomicLoad( &${a} ) == atomicLoad( &${b} ) )`;
  },

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushU32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullU32Array[ offset ];
  },

  valueType: wgsl`atomic<u32>`,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`atomicLoad( &${value} )` )}
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

  identity: U32_IDENTITY_VALUES.add,
  apply: ( a: number, b: number ): number => a + b,

  identityWGSL: u32S( U32_IDENTITY_VALUES.add ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} + ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ${a} + ${b};`,
  atomicName: 'atomicAdd'
};
alpenglow.register( 'U32Add', U32Add );

export const U32Min: BinaryOp<number> = {
  name: 'u32 min',
  type: U32Type,
  isCommutative: true,

  identity: U32_IDENTITY_VALUES.min,
  apply: ( a: number, b: number ): number => Math.min( a, b ),

  identityWGSL: u32S( U32_IDENTITY_VALUES.min ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`min( ${a}, ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = min( ${a} + ${b} );`,
  atomicName: 'atomicMin'
};
alpenglow.register( 'U32Min', U32Min );

export const U32Max: BinaryOp<number> = {
  name: 'u32 max',
  type: U32Type,
  isCommutative: true,

  identity: U32_IDENTITY_VALUES.max,
  apply: ( a: number, b: number ): number => Math.max( a, b ),

  identityWGSL: u32S( U32_IDENTITY_VALUES.max ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`max( ${a}, ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = max( ${a} + ${b} );`,
  atomicName: 'atomicMax'
};
alpenglow.register( 'U32Max', U32Max );

export const U32And: BinaryOp<number> = {
  name: 'u32 and',
  type: U32Type,
  isCommutative: true,

  identity: U32_IDENTITY_VALUES.and,
  apply: ( a: number, b: number ): number => ( a & b ) >>> 0,

  identityWGSL: u32S( U32_IDENTITY_VALUES.and ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} & ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ( ${a} & ${b} );`,
  atomicName: 'atomicAnd'
};
alpenglow.register( 'U32And', U32And );

export const U32Or: BinaryOp<number> = {
  name: 'u32 or',
  type: U32Type,
  isCommutative: true,

  identity: U32_IDENTITY_VALUES.or,
  apply: ( a: number, b: number ): number => ( a | b ) >>> 0,

  identityWGSL: u32S( U32_IDENTITY_VALUES.or ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} | ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ( ${a} | ${b} );`,
  atomicName: 'atomicOr'
};
alpenglow.register( 'U32Or', U32Or );

export const U32Xor: BinaryOp<number> = {
  name: 'u32 xor',
  type: U32Type,
  isCommutative: true,

  identity: U32_IDENTITY_VALUES.xor,
  apply: ( a: number, b: number ): number => ( a ^ b ) >>> 0,

  identityWGSL: u32S( U32_IDENTITY_VALUES.xor ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} ^ ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ( ${a} ^ ${b} );`,
  atomicName: 'atomicXor'
};
alpenglow.register( 'U32Xor', U32Xor );

export const U32Order: Order<number> = {
  name: 'u32 order',
  type: U32Type,

  compare( a: number, b: number ): number {
    return a - b;
  },

  getBits: ( value: number, bitOffset: number, bitQuantity: number ): number => {
    return ( ( value >>> bitOffset ) & ( ( 1 << bitQuantity ) - 1 ) ) >>> 0;
  },

  compareWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionI32 => {
    // TODO: THIS FAILS RANGE CHECKS
    // return `( i32( ${a} ) - i32( ${b} ) )`;

    return wgsl`select( select( 0i, 1i, ${a} > ${b} ), -1i, ${a} < ${b} )`;
  },

  greaterThanWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} > ${b} )`;
  },

  lessThanOrEqualWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} <= ${b} )`;
  },

  getBitsWGSL: ( value: WGSLExpressionT, bitOffset: number, bitQuantity: number ): WGSLExpressionU32 => {
    return wgsl`( ( ${value} >> ${u32S( bitOffset )} ) & ${u32S( ( 1 << bitQuantity ) - 1 )} )`;
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

  compareWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionI32 => {
    return wgsl`select( select( 0i, 1i, ${a} < ${b} ), -1i, ${a} > ${b} )`;
  },

  greaterThanWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} < ${b} )`;
  },

  lessThanOrEqualWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} >= ${b} )`;
  },

  getBitsWGSL: ( value: WGSLExpressionT, bitOffset: number, bitQuantity: number ): WGSLExpressionU32 => {
    // TODO: is there a bitwise trick?
    return wgsl`( ( ( 0xffffffffu - ${value} ) >> ${u32S( bitOffset )} ) & ${u32S( ( 1 << bitQuantity ) - 1 )} )`;
  }
};
alpenglow.register( 'U32ReverseOrder', U32ReverseOrder );

export const I32Type: ConcreteType<number> = {
  name: 'i32',
  bytesPerElement: 4,

  outOfRangeElement: 101010101,

  equals( a: number, b: number ): boolean {
    return a === b;
  },

  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} == ${b} )`;
  },

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushI32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullI32Array[ offset ];
  },

  valueType: wgsl`i32`,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`bitcast<u32>( ${value} )` )}
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

  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( atomicLoad( &${a} ) == atomicLoad( &${b} ) )`;
  },

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushU32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullU32Array[ offset ];
  },

  valueType: wgsl`atomic<i32>`,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`bitcast<u32>( atomicLoad( &${value} ) )` )}
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

  identity: I32_IDENTITY_VALUES.add,
  apply: ( a: number, b: number ): number => a + b,

  identityWGSL: i32S( I32_IDENTITY_VALUES.add ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} + ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ${a} + ${b};`,
  atomicName: 'atomicAdd'
};
alpenglow.register( 'I32Add', I32Add );

export const I32Min: BinaryOp<number> = {
  name: 'i32 min',
  type: I32Type,
  isCommutative: true,

  identity: I32_IDENTITY_VALUES.min,
  apply: ( a: number, b: number ): number => Math.min( a, b ),

  identityWGSL: i32S( I32_IDENTITY_VALUES.min ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`min( ${a}, ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = min( ${a} + ${b} );`,
  atomicName: 'atomicMin'
};
alpenglow.register( 'I32Min', I32Min );

export const I32Max: BinaryOp<number> = {
  name: 'i32 max',
  type: I32Type,
  isCommutative: true,

  identity: I32_IDENTITY_VALUES.max,
  apply: ( a: number, b: number ): number => Math.max( a, b ),

  identityWGSL: i32S( I32_IDENTITY_VALUES.max ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`max( ${a}, ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = max( ${a} + ${b} );`,
  atomicName: 'atomicMax'
};
alpenglow.register( 'I32Max', I32Max );

export const I32And: BinaryOp<number> = {
  name: 'i32 and',
  type: I32Type,
  isCommutative: true,

  identity: I32_IDENTITY_VALUES.and,
  apply: ( a: number, b: number ): number => ( a & b ) >>> 0,

  identityWGSL: i32S( I32_IDENTITY_VALUES.and ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} & ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ( ${a} & ${b} );`,
  atomicName: 'atomicAnd'
};
alpenglow.register( 'I32And', I32And );

export const I32Or: BinaryOp<number> = {
  name: 'i32 or',
  type: I32Type,
  isCommutative: true,

  identity: I32_IDENTITY_VALUES.or,
  apply: ( a: number, b: number ): number => ( a | b ) >>> 0,

  identityWGSL: i32S( I32_IDENTITY_VALUES.or ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} | ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ( ${a} | ${b} );`,
  atomicName: 'atomicOr'
};
alpenglow.register( 'I32Or', I32Or );

export const I32Xor: BinaryOp<number> = {
  name: 'i32 xor',
  type: I32Type,
  isCommutative: true,

  identity: I32_IDENTITY_VALUES.xor,
  apply: ( a: number, b: number ): number => ( a ^ b ) >>> 0,

  identityWGSL: i32S( I32_IDENTITY_VALUES.xor ),
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} ^ ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ( ${a} ^ ${b} );`,
  atomicName: 'atomicXor'
};
alpenglow.register( 'I32Xor', I32Xor );

// TODO: Do a full order, with bit sorts(!)
export const I32Order: CompareOrder<number> = {
  name: 'i32 order',
  type: I32Type,

  compare( a: number, b: number ): number {
    return a - b;
  },

  compareWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionI32 => {
    return wgsl`( ${a} - ${b} )`;
  },

  greaterThanWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} > ${b} )`;
  },

  lessThanOrEqualWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} <= ${b} )`;
  }
};
alpenglow.register( 'I32Order', I32Order );

export const F32Type: ConcreteType<number> = {
  name: 'f32',
  bytesPerElement: 4,

  outOfRangeElement: 7.101010101,

  equals( a: number, b: number ): boolean {
    return a === b;
  },

  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} == ${b} )`;
  },

  encode( value: number, encoder: ByteEncoder ): void {
    encoder.pushF32( value );
  },
  decode( encoder: ByteEncoder, offset: number ): number {
    return encoder.fullF32Array[ offset ];
  },

  valueType: wgsl`f32`,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`bitcast<u32>( ${value} )` )}
    `;
  },
  wgslAlign: 4,
  wgslSize: 4,

  generateRandom: ( fullSize = false ) => random.nextDoubleBetween( fullSize ? -0x7fffffff : 0, fullSize ? 0x7fffffff : 1 ),

  toDebugString: ( value: number ) => value.toString()
};
alpenglow.register( 'F32Type', F32Type );

// TODO: Do a full order, with bit sorts(!)
export const F32Order: CompareOrder<number> = {
  name: 'f32 order',
  type: F32Type,

  compare( a: number, b: number ): number {
    return a - b;
  },

  compareWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionI32 => {
    return wgsl`select( select( 0i, 1i, ${a} > ${b} ), -1i, ${a} < ${b} )`;
  },

  greaterThanWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} > ${b} )`;
  },

  lessThanOrEqualWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a} <= ${b} )`;
  }
};
alpenglow.register( 'F32Order', F32Order );

export const Vec2uType: ConcreteType<Vector2> = {
  name: 'vec2u',
  bytesPerElement: 8,

  outOfRangeElement: new Vector2( 101010101, 101010101 ),

  equals( a: Vector2, b: Vector2 ): boolean {
    return a.equals( b );
  },

  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    // TODO: test
    return wgsl`all( ${a} == ${b} )`;
  },

  encode( value: Vector2, encoder: ByteEncoder ): void {
    encoder.pushU32( value.x );
    encoder.pushU32( value.y );
  },
  decode( encoder: ByteEncoder, offset: number ): Vector2 {
    return new Vector2( encoder.fullU32Array[ offset ], encoder.fullU32Array[ offset + 1 ] );
  },

  valueType: wgsl`vec2u`,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`${value}.x` )}
       ${storeStatement( wgsl`1u`, wgsl`${value}.y` )}
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

  identityWGSL: wgsl`vec2u()`,
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} + ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ${a} + ${b};`
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

  identityWGSL: wgsl`vec2( 0u )`,
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} + ${b} - min( ${a}.y, ${b}.x ) )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ${a} + ${b} - min( ${a}.y, ${b}.x );`
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

  // TODO: potentially stuff this in a function so it is more readable?
  compareWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionI32 => {
    return wgsl`select( select( select( select( 0i, 1i, ${a}.y > ${b}.y ), -1i, ${a}.y < ${b}.y ), 1i, ${a}.x > ${b}.x ), -1i, ${a}.x < ${b}.x )`;
  },

  greaterThanWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a}.x > ${b}.x || ( ${a}.x == ${b}.x && ${a}.y > ${b}.y ) )`;
  },

  lessThanOrEqualWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    return wgsl`( ${a}.x <= ${b}.x && ( ${a}.x != ${b}.x || ${a}.y <= ${b}.y ) )`;
  },

  getBitsWGSL: ( value: WGSLExpressionT, bitOffset: number, bitQuantity: number ): WGSLExpressionU32 => {
    // NOTE: WGSL doesn't like `<< 32u`, so we split it like so.
    if ( bitOffset === 0 ) {
      return wgsl`( ( ${value}.y >> ${u32S( bitOffset )} ) & ${u32S( ( 1 << bitQuantity ) - 1 )} )`;
    }
    else if ( bitOffset < 32 ) {
      return wgsl`( ( ( ${value}.x << ${u32S( 32 - bitOffset )} ) & ${u32S( ( 1 << bitQuantity ) - 1 )} ) | ( ( ${value}.y >> ${u32S( bitOffset )} ) & ${u32S( ( 1 << bitQuantity ) - 1 )} ) )`;
    }
    else {
      return wgsl`( ( ${value}.x >> ${u32S( bitOffset - 32 )} ) & ${u32S( ( 1 << bitQuantity ) - 1 )} )`;
    }
  }
};
alpenglow.register( 'Vec2uLexicographicalOrder', Vec2uLexicographicalOrder );

export const Vec3uType: ConcreteType<Vector3> = {
  name: 'vec3u',
  bytesPerElement: 12,

  outOfRangeElement: new Vector3( 101010101, 101010101, 101010101 ),

  equals( a: Vector3, b: Vector3 ): boolean {
    return a.equals( b );
  },

  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    // TODO: test
    return wgsl`all( ${a} == ${b} )`;
  },

  encode( value: Vector3, encoder: ByteEncoder ): void {
    encoder.pushU32( value.x );
    encoder.pushU32( value.y );
    encoder.pushU32( value.z );
  },
  decode( encoder: ByteEncoder, offset: number ): Vector3 {
    return new Vector3( encoder.fullU32Array[ offset ], encoder.fullU32Array[ offset + 1 ], encoder.fullU32Array[ offset + 2 ] );
  },

  valueType: wgsl`vec3u`,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`${value}.x` )}
       ${storeStatement( wgsl`1u`, wgsl`${value}.y` )}
       ${storeStatement( wgsl`2u`, wgsl`${value}.z` )}
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

  identityWGSL: wgsl`vec3u()`,
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} + ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ${a} + ${b};`
};
alpenglow.register( 'Vec3uAdd', Vec3uAdd );

export const Vec4uType: ConcreteType<Vector4> = {
  name: 'vec4u',
  bytesPerElement: 16,

  outOfRangeElement: new Vector4( 101010101, 101010101, 101010101, 101010101 ),

  equals( a: Vector4, b: Vector4 ): boolean {
    return a.equals( b );
  },

  equalsWGSL: ( a: WGSLExpressionT, b: WGSLExpressionT ): WGSLExpressionBool => {
    // TODO: test
    return wgsl`all( ${a} == ${b} )`;
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

  valueType: wgsl`vec4u`,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`${value}.x` )}
       ${storeStatement( wgsl`1u`, wgsl`${value}.y` )}
       ${storeStatement( wgsl`2u`, wgsl`${value}.z` )}
       ${storeStatement( wgsl`3u`, wgsl`${value}.w` )}
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

  identityWGSL: wgsl`vec4u()`,
  combineExpression: ( a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`( ${a} + ${b} )`,
  combineStatements: ( varName: WGSLVariableName, a: WGSLExpressionT, b: WGSLExpressionT ) => wgsl`${varName} = ${a} + ${b};`
};
alpenglow.register( 'Vec4uAdd', Vec4uAdd );