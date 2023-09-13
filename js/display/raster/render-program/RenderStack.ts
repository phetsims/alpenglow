// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for repeated compositing of multiple RenderPrograms in a row with normal blending and source-over
 * Porter-Duff composition.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderEvaluationContext, RenderProgram, scenery, SerializedRenderProgram } from '../../../imports.js';
import Vector4 from '../../../../../dot/js/Vector4.js';

export default class RenderStack extends RenderProgram {
  /**
   * @param children - Ordered from back to front, like Scenery's Node.children
   */
  public constructor(
    children: RenderProgram[]
  ) {
    super(
      children,
      _.every( children, RenderProgram.closureIsFullyTransparent ),
      _.some( children, RenderProgram.closureIsFullyOpaque )
    );
  }

  public override getName(): string {
    return 'RenderStack';
  }

  public override withChildren( children: RenderProgram[] ): RenderStack {
    assert && assert( children.length === this.children.length );
    return new RenderStack( children );
  }

  public override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    children = children.filter( child => !child.isFullyTransparent );

    // If there is an opaque child, nothing below it matters (drop everything before it)
    for ( let i = children.length - 1; i >= 0; i-- ) {
      const child = children[ i ];
      if ( child.isFullyOpaque ) {
        children = children.slice( i );
        break;
      }
    }

    // Collapse other RenderStacks into this one
    const collapsedChildren: RenderProgram[] = [];
    for ( let i = 0; i < children.length; i++ ) {
      const child = children[ i ];
      if ( child instanceof RenderStack ) {
        collapsedChildren.push( ...child.children );
      }
      else {
        collapsedChildren.push( child );
      }
    }
    children = collapsedChildren;

    // Attempt to blend adjacent colors
    const blendedChildren: RenderProgram[] = [];
    for ( let i = 0; i < children.length; i++ ) {
      const child = children[ i ];
      const lastChild = blendedChildren[ blendedChildren.length - 1 ];

      if ( i > 0 && child instanceof RenderColor && lastChild instanceof RenderColor ) {
        blendedChildren.pop();
        blendedChildren.push( new RenderColor( RenderStack.combine( child.color, lastChild.color ) ) );
      }
      else {
        blendedChildren.push( child );
      }
    }
    children = blendedChildren;

    if ( children.length === 0 ) {
      return RenderColor.TRANSPARENT;
    }
    else if ( children.length === 1 ) {
      return children[ 0 ];
    }
    else if ( this.children.length !== children.length || _.some( this.children, ( child, i ) => child !== children[ i ] ) ) {
      return new RenderStack( children );
    }
    else {
      return null;
    }
  }

  public static combine( a: Vector4, b: Vector4 ): Vector4 {
    const backgroundAlpha = 1 - a.w;

    return new Vector4(
      a.x + backgroundAlpha * b.x,
      a.y + backgroundAlpha * b.y,
      a.z + backgroundAlpha * b.z,
      a.w + backgroundAlpha * b.w
    );
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {

    const numChildren = this.children.length;

    // Bail if we have zero children, since we'll do an initialization based on the last child
    if ( numChildren === 0 ) {
      return Vector4.ZERO;
    }

    // Initialize it with the "last" color, so we don't need to do any extra blending operations
    const lastColor = this.children[ numChildren - 1 ].evaluate( context );
    const color = lastColor.copy(); // we will mutate it, so we'll make a copy

    // We'll abuse the associativity of this blending operation to START with the "top" content. Thus each iteration
    // will add in the "background" color, bailing if we reach full opacity.
    // NOTE: the extra for-command condition
    for ( let i = this.children.length - 2; i >= 0 && color.w !== 1; i-- ) {
      const blendColor = this.children[ i ].evaluate( context );
      const backgroundAlpha = 1 - color.w;

      // Assume premultiplied
      color.setXYZW(
        backgroundAlpha * blendColor.x + color.x,
        backgroundAlpha * blendColor.y + color.y,
        backgroundAlpha * blendColor.z + color.z,
        backgroundAlpha * blendColor.w + color.w
      );
    }

    return color;
  }

  public override serialize(): SerializedRenderStack {
    return {
      type: 'RenderStack',
      children: this.children.map( child => child.serialize() )
    };
  }

  public static override deserialize( obj: SerializedRenderStack ): RenderStack {
    return new RenderStack( obj.children.map( child => RenderProgram.deserialize( child ) ) );
  }
}

scenery.register( 'RenderStack', RenderStack );

export type SerializedRenderStack = {
  type: 'RenderStack';
  children: SerializedRenderProgram[];
};
