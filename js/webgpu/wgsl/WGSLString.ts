// Copyright 2024-2026, University of Colorado Boulder

/**
 * Represents a string of WGSL code (which may have dependencies which it can add to a blueprint).
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import type { BindingType } from '../compute/BindingType.js';
import { decimal } from '../compute/decimal.js';
import { f32 } from '../compute/f32.js';
import { i32 } from '../compute/i32.js';
import { i32Hex } from '../compute/i32Hex.js';
import type { PipelineBlueprint } from '../compute/PipelineBlueprint.js';
import type { ResourceSlot } from '../compute/ResourceSlot.js';
import { u32 } from '../compute/u32.js';
import { u32Hex } from '../compute/u32Hex.js';

export abstract class WGSLString {
  public abstract withBlueprint( blueprint: PipelineBlueprint ): string;

  // TODO: consider adding precedence to the expression types, so we can avoid unnecessary parentheses
}

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

// TODO: use this where we need
export class WGSLModule extends WGSLString {
  public constructor(
    public readonly name: string,
    public readonly declarations: WGSLModuleDeclarations
  ) {
    super();
  }

  public withBlueprint( blueprint: PipelineBlueprint ): string {
    blueprint.add( this.name, this.declarations );
    return '';
  }
}

export class WGSLMainModule extends WGSLModule {
  public constructor(
    public readonly slots: WGSLSlot[],
    declarations: WGSLModuleDeclarations
  ) {
    super( 'main', declarations );
  }

  public override withBlueprint( blueprint: PipelineBlueprint ): string {
    this.slots.forEach( slot => {
      slot.withBlueprint( blueprint );
    } );

    return super.withBlueprint( blueprint );
  }
}

export class WGSLReferenceModule extends WGSLString {
  public constructor(
    public readonly name: string,
    public readonly declarations: WGSLModuleDeclarations
  ) {
    super();
  }

  public withBlueprint( blueprint: PipelineBlueprint ): string {
    blueprint.add( this.name, this.declarations );
    return this.name;
  }
}

export class WGSLStringModule extends WGSLString {
  public constructor(
    public readonly name: string,
    public readonly string: WGSLString,
    public readonly declarations: WGSLModuleDeclarations
  ) {
    super();
  }

  public withBlueprint( blueprint: PipelineBlueprint ): string {
    blueprint.add( this.name, this.declarations );
    return this.string.withBlueprint( blueprint );
  }
}

export class WGSLSlot extends WGSLModule {
  public constructor(
     name: string,
     public readonly slot: ResourceSlot,
     public readonly bindingType: BindingType
  ) {
    super( name, wgsl`` );
  }

  public override withBlueprint( blueprint: PipelineBlueprint ): string {
    blueprint.addSlot( this.name, this.slot, this.bindingType );
    return '';
  }
}

export const wgslString = ( value: string ): WGSLStringLiteral => {
  return new WGSLStringLiteral( value );
};

export const wgslFunction = ( value: ( blueprint: PipelineBlueprint ) => string ): WGSLStringFunction => {
  return new WGSLStringFunction( value );
};

export const wgslBlueprint = ( value: ( blueprint: PipelineBlueprint ) => WGSLString ): WGSLStringFunction => {
  return new WGSLStringFunction( blueprint => value( blueprint ).withBlueprint( blueprint ) );
};

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

export const u32S = ( n: number ): WGSLExpressionU32 => wgslString( u32( n ) );

export const u32HexS = ( n: number ): WGSLExpressionU32 => wgslString( u32Hex( n ) );

export const i32S = ( n: number ): WGSLExpressionI32 => wgslString( i32( n ) );

export const i32HexS = ( n: number ): WGSLExpressionI32 => wgslString( i32Hex( n ) );

export const f32S = ( n: number ): WGSLExpressionF32 => wgslString( f32( n ) );

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

export const wgslOneLine = ( value: WGSLString ): WGSLString => {
  return new WGSLStringFunction( blueprint => {
    return value.withBlueprint( blueprint ).replace( /\n/g, ' ' );
  } );
};

export const wgslWith = ( value: WGSLString, ...modules: WGSLModule[] ): WGSLString => {
  return new WGSLStringFunction( blueprint => {
    modules.forEach( module => {
      module.withBlueprint( blueprint );
    } );

    return value.withBlueprint( blueprint );
  } );
};
