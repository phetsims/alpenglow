// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for a phong 3d reflection model
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderEvaluationContext, RenderLight, RenderProgram, alpenglow, SerializedRenderProgram, RenderInstruction, RenderExecutionStack, RenderExecutor, RenderInstructionLocation, ByteEncoder } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';

export default class RenderPhong extends RenderProgram {
  public constructor(
    public readonly alpha: number,
    public readonly ambientColorProgram: RenderProgram,
    public readonly diffuseColorProgram: RenderProgram,
    public readonly specularColorProgram: RenderProgram,
    public readonly positionProgram: RenderProgram,
    public readonly normalProgram: RenderProgram,
    public readonly lights: RenderLight[]
  ) {
    super(
      [
        ambientColorProgram,
        diffuseColorProgram,
        specularColorProgram,
        positionProgram,
        normalProgram,
        ...lights.map( light => [ light.directionProgram, light.colorProgram ] ).flat()
      ],
      false,
      false
    );
  }

  public override getName(): string {
    return 'RenderPhong';
  }

  public override withChildren( children: RenderProgram[] ): RenderPhong {
    assert && assert( children.length >= 5 && children.length % 1 === 0 );

    const lightChildren = children.slice( 5 );

    return new RenderPhong(
      this.alpha,
      children[ 0 ], children[ 1 ], children[ 2 ], children[ 3 ], children[ 4 ],
      _.range( 0, lightChildren.length / 2 ).map( i => {
        return new RenderLight( lightChildren[ 2 * i ], lightChildren[ 2 * i + 1 ] );
      } ) );
  }

  protected override equalsTyped( other: this ): boolean {
    return this.alpha === other.alpha;
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    const ambientColorProgram = children[ 0 ];
    const diffuseColorProgram = children[ 1 ];
    const specularColorProgram = children[ 2 ];
    const positionProgram = children[ 3 ];
    const normalProgram = children[ 4 ];
    const lightChildren = children.slice( 5 );

    const numLights = lightChildren.length / 2;
    const lightDirectionPrograms = _.range( 0, numLights ).map( i => lightChildren[ 2 * i ] );
    const lightColorPrograms = _.range( 0, numLights ).map( i => lightChildren[ 2 * i + 1 ] );

    if (
      normalProgram.isFullyTransparent ||
      ( ambientColorProgram.isFullyTransparent && diffuseColorProgram.isFullyTransparent && specularColorProgram.isFullyTransparent )
    ) {
      return RenderColor.TRANSPARENT;
    }
    else if (
      ambientColorProgram instanceof RenderColor &&
      diffuseColorProgram instanceof RenderColor &&
      specularColorProgram instanceof RenderColor &&
      positionProgram instanceof RenderColor &&
      normalProgram instanceof RenderColor &&
      lightDirectionPrograms.every( program => program instanceof RenderColor ) &&
      lightColorPrograms.every( program => program instanceof RenderColor )
    ) {
      return new RenderColor(
        this.getPhong(
          ambientColorProgram.color,
          diffuseColorProgram.color,
          specularColorProgram.color,
          positionProgram.color,
          normalProgram.color,
          lightDirectionPrograms.map( program => ( program as RenderColor ).color ),
          lightColorPrograms.map( program => ( program as RenderColor ).color )
        )
      );
    }
    else {
      return null;
    }
  }

  public getPhong( ambientColor: Vector4, diffuseColor: Vector4, specularColor: Vector4, position: Vector4, normal: Vector4, lightDirections: Vector4[], lightColors: Vector4[] ): Vector4 {
    assert && assert( ambientColor.isFinite() );
    assert && assert( diffuseColor.isFinite() );
    assert && assert( specularColor.isFinite() );
    assert && assert( position.isFinite() );
    assert && assert( normal.isFinite() );
    assert && assert( lightDirections.every( direction => direction.isFinite() ) );
    assert && assert( lightDirections.every( direction => Math.abs( direction.magnitudeSquared - 1 ) < 1e-5 ) );
    assert && assert( lightColors.every( color => color.isFinite() ) );
    assert && assert( lightDirections.length === lightColors.length );

    const result = ambientColor.copy();

    for ( let i = 0; i < lightDirections.length; i++ ) {
      const lightDirection = lightDirections[ i ];
      const lightColor = lightColors[ i ];

      const dot = normal.dot( lightDirection );
      if ( dot > 0 ) {
        const diffuseColorContribution = lightColor.componentTimes( diffuseColor ).times( dot );
        diffuseColorContribution.w = lightColor.w * diffuseColor.w; // keep alpha
        result.add( diffuseColorContribution );

        // TODO: don't assume camera is at origin?
        const viewDirection = position.negated().normalized();
        const reflectedDirection = normal.timesScalar( 2 * dot ).minus( lightDirection );
        const specularContribution = Math.pow( reflectedDirection.dot( viewDirection ), this.alpha );
        const specularColorContribution = lightColor.componentTimes( specularColor ).times( specularContribution );
        specularColorContribution.w = lightColor.w * specularColor.w; // keep alpha
        result.add( specularColorContribution );
      }
    }

    // clamp for now
    result.x = Math.min( 1, result.x );
    result.y = Math.min( 1, result.y );
    result.z = Math.min( 1, result.z );
    result.w = Math.min( 1, result.w );

    return result;
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    const ambientColor = this.ambientColorProgram.evaluate( context );
    const diffuseColor = this.diffuseColorProgram.evaluate( context );
    const specularColor = this.specularColorProgram.evaluate( context );
    const position = this.positionProgram.evaluate( context );
    const normal = this.normalProgram.evaluate( context );

    // TODO: optimize?
    const lightDirections = _.range( 0, this.lights.length ).map( i => {
      return this.lights[ i ].directionProgram.evaluate( context );
    } );
    const lightColors = _.range( 0, this.lights.length ).map( i => {
      return this.lights[ i ].colorProgram.evaluate( context );
    } );

    return this.getPhong(
      ambientColor,
      diffuseColor,
      specularColor,
      position,
      normal,
      lightDirections,
      lightColors
    );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    for ( let i = 0; i < this.lights.length; i++ ) {
      this.lights[ i ].colorProgram.writeInstructions( instructions );
      this.lights[ i ].directionProgram.writeInstructions( instructions );
    }
    this.normalProgram.writeInstructions( instructions );
    this.positionProgram.writeInstructions( instructions );
    this.specularColorProgram.writeInstructions( instructions );
    this.diffuseColorProgram.writeInstructions( instructions );
    this.ambientColorProgram.writeInstructions( instructions );
    instructions.push( new RenderInstructionPhong( this.alpha, this.lights.length ) );
  }

  public override serialize(): SerializedRenderPhong {
    return {
      type: 'RenderPhong',
      children: this.children.map( child => child.serialize() ),
      alpha: this.alpha
    };
  }

  public static override deserialize( obj: SerializedRenderPhong ): RenderPhong {
    // @ts-expect-error
    return new RenderPhong( obj.alpha, ...obj.children.map( RenderProgram.deserialize ) );
  }
}

alpenglow.register( 'RenderPhong', RenderPhong );

const scratchAmbientVector = new Vector4( 0, 0, 0, 0 );
const scratchDiffuseVector = new Vector4( 0, 0, 0, 0 );
const scratchSpecularVector = new Vector4( 0, 0, 0, 0 );
const scratchPositionVector = new Vector4( 0, 0, 0, 0 );
const scratchNormalVector = new Vector4( 0, 0, 0, 0 );
const scratchLightDirectionVector = new Vector4( 0, 0, 0, 0 );
const scratchLightColorVector = new Vector4( 0, 0, 0, 0 );
const scratchOutputVector = new Vector4( 0, 0, 0, 0 );
const scratchViewDirectionVector = new Vector4( 0, 0, 0, 0 );
const scratchReflectionVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionPhong extends RenderInstruction {
  public constructor(
    public readonly alpha: number,
    public readonly numLights: number
  ) {
    super();
  }

  public override toString(): string {
    const alpha = `alpha:${this.alpha}`;
    const numLights = `numLights:${this.numLights}`;
    return `RenderInstructionPhong(${alpha} ${numLights})`;
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionPhong && this.alpha === other.alpha && this.numLights === other.numLights;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.popInto( scratchAmbientVector );
    stack.popInto( scratchDiffuseVector );
    stack.popInto( scratchSpecularVector );
    stack.popInto( scratchPositionVector );
    stack.popInto( scratchNormalVector );

    scratchOutputVector.set( scratchAmbientVector );

    // TODO: don't assume camera is at origin?
    scratchViewDirectionVector.set( scratchPositionVector ).negate().normalize();

    for ( let i = 0; i < this.numLights; i++ ) {
      stack.popInto( scratchLightDirectionVector );
      stack.popInto( scratchLightColorVector );

      const dot = scratchNormalVector.dot( scratchLightDirectionVector );
      if ( dot > 0 ) {
        scratchReflectionVector.set( scratchNormalVector ).multiplyScalar( 2 * dot ).subtract( scratchLightDirectionVector );
        const specularContribution = Math.pow( scratchReflectionVector.dot( scratchViewDirectionVector ), this.alpha );

        scratchOutputVector.addXYZW(
          scratchLightColorVector.x * scratchDiffuseVector.x * dot +
          scratchLightColorVector.x * scratchSpecularVector.x * specularContribution,
          scratchLightColorVector.y * scratchDiffuseVector.y * dot +
          scratchLightColorVector.y * scratchSpecularVector.y * specularContribution,
          scratchLightColorVector.z * scratchDiffuseVector.z * dot +
          scratchLightColorVector.z * scratchSpecularVector.z * specularContribution,
          scratchLightColorVector.w * scratchDiffuseVector.w +
          scratchLightColorVector.w * scratchSpecularVector.w // keep alphas
        );
      }
    }

    // clamp for now
    stack.pushValues(
      Math.min( 1, scratchOutputVector.x ),
      Math.min( 1, scratchOutputVector.y ),
      Math.min( 1, scratchOutputVector.z ),
      Math.min( 1, scratchOutputVector.w )
    );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.PhongCode );
    encoder.pushF32( this.alpha );
    encoder.pushU32( this.numLights ); // TODO: why not toss this... into the PhongCode U32?
  }

  public static fromBinary(
    encoder: ByteEncoder,
    offset: number,
    getLocation: ( offset: number ) => RenderInstructionLocation
  ): RenderInstructionPhong {
    const alpha = encoder.fullF32Array[ offset + 1 ];
    const numLights = encoder.fullU32Array[ offset + 2 ];
    return new RenderInstructionPhong( alpha, numLights );
  }

  public override getBinaryLength(): number {
    return 3;
  }
}

export type SerializedRenderPhong = {
  type: 'RenderPhong';
  children: SerializedRenderProgram[];
  alpha: number;
};
