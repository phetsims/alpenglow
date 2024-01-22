// Copyright 2024, University of Colorado Boulder

/**
 * Represents a string of WGSL code (which may have dependencies which it can add to a blueprint).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, decimal, f32, i32, i32Hex, PipelineBlueprint, u32, u32Hex } from '../../imports.js';

export default abstract class WGSLString {
  public abstract withBlueprint( blueprint: PipelineBlueprint ): string;

  // TODO: consider adding precedence to the expression types, so we can avoid unnecessary parentheses
}
alpenglow.register( 'WGSLString', WGSLString );

export class WGSLStringLiteral extends WGSLString {
  public constructor(
    public readonly value: string
  ) {
    super();
  }

  public withBlueprint( blueprint: PipelineBlueprint ): string {
    return this.value;
  }
}
alpenglow.register( 'WGSLStringLiteral', WGSLStringLiteral );

export class WGSLStringFunction extends WGSLString {
  public constructor(
    public readonly value: ( blueprint: PipelineBlueprint ) => string
  ) {
    super();
  }

  public withBlueprint( blueprint: PipelineBlueprint ): string {
    return this.value( blueprint );
  }
}
alpenglow.register( 'WGSLStringFunction', WGSLStringFunction );

export class WGSLStringAccumulator extends WGSLString {

  public readonly values: WGSLString[] = [];

  public add( value: WGSLString ): void {
    this.values.push( value );
  }

  public withBlueprint( blueprint: PipelineBlueprint ): string {
    let string = '';
    for ( let i = 0; i < this.values.length; i++ ) {
      string += this.values[ i ].withBlueprint( blueprint );
    }
    return string;
  }
}
alpenglow.register( 'WGSLStringAccumulator', WGSLStringAccumulator );

export const wgslString = ( value: string ): WGSLStringLiteral => {
  return new WGSLStringLiteral( value );
};
alpenglow.register( 'wgslString', wgslString );

export const wgslFunction = ( value: ( blueprint: PipelineBlueprint ) => string ): WGSLStringFunction => {
  return new WGSLStringFunction( value );
};
alpenglow.register( 'wgslFunction', wgslFunction );

// For tagged template literals
export const wgsl = ( strings: TemplateStringsArray, ...values: WGSLString[] ): WGSLString => {
  return new WGSLStringFunction( blueprint => {
    let string = '';
    for ( let i = 0; i < strings.length; i++ ) {
      string += strings[ i ];
      if ( i < values.length ) {
        const value = values[ i ];

        string += value.withBlueprint( blueprint );
      }
    }
    return string;
  } );
};
alpenglow.register( 'wgsl', wgsl );

export type WGSLExpression = WGSLString;
export type WGSLExpressionU32 = WGSLExpression;
export type WGSLExpressionI32 = WGSLExpression;
export type WGSLExpressionF32 = WGSLExpression;
export type WGSLExpressionBool = WGSLExpression;
export type WGSLExpressionT = WGSLExpression; // For use when we have a generic type
export type WGSLStatements = WGSLString;
export type WGSLModuleDeclarations = WGSLString;
export type WGSLVariableName = WGSLString;
export type WGSLType = WGSLString;
export type WGSLBinaryExpression = ( a: WGSLExpression, b: WGSLExpression ) => WGSLExpression;

// TODO: ideally once we're to a point, we can replace the normal versions with these

// TODO: also, hopefully we can rename them (so we work with the good type) before then

export const decimalS = ( n: number ): WGSLString => wgslString( decimal( n ) );
alpenglow.register( 'decimalS', decimalS );

export const u32S = ( n: number ): WGSLExpressionU32 => wgslString( u32( n ) );
alpenglow.register( 'u32S', u32S );

export const u32HexS = ( n: number ): WGSLExpressionU32 => wgslString( u32Hex( n ) );
alpenglow.register( 'u32HexS', u32HexS );

export const i32S = ( n: number ): WGSLExpressionI32 => wgslString( i32( n ) );
alpenglow.register( 'i32S', i32S );

export const i32HexS = ( n: number ): WGSLExpressionI32 => wgslString( i32Hex( n ) );
alpenglow.register( 'i32HexS', i32HexS );

export const f32S = ( n: number ): WGSLExpressionF32 => wgslString( f32( n ) );
alpenglow.register( 'f32S', f32S );

export const wgslJoin = ( separator: string, values: WGSLString[] ): WGSLString => {
  return new WGSLStringFunction( blueprint => {
    let string = '';
    for ( let i = 0; i < values.length; i++ ) {
      if ( i > 0 ) {
        string += separator;
      }
      string += values[ i ].withBlueprint( blueprint );
    }
    return string;
  } );
};
alpenglow.register( 'wgslJoin', wgslJoin );

export const wgslMapJoin = <T>( separator: string, values: T[], mapper: ( value: T ) => WGSLString ): WGSLString => {
  return new WGSLStringFunction( blueprint => {
    let string = '';
    for ( let i = 0; i < values.length; i++ ) {
      if ( i > 0 ) {
        string += separator;
      }
      string += mapper( values[ i ] ).withBlueprint( blueprint );
    }
    return string;
  } );
};
alpenglow.register( 'wgslMapJoin', wgslMapJoin );

export const wgslOneLine = ( value: WGSLString ): WGSLString => {
  return new WGSLStringFunction( blueprint => {
    return value.withBlueprint( blueprint ).replace( /\n/g, ' ' );
  } );
};
alpenglow.register( 'wgslOneLine', wgslOneLine );

export const wgslWith = ( value: WGSLString, declarationName: string, declaration: WGSLModuleDeclarations ): WGSLString => {
  return new WGSLStringFunction( blueprint => {
    // TODO: can we get a better "add" functionality?
    blueprint.add( declarationName, declaration );

    return value.withBlueprint( blueprint );
  } );
};
alpenglow.register( 'wgslWith', wgslWith );
