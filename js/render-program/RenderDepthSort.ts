// Copyright 2023-2025, University of Colorado Boulder

/**
 * RenderProgram that provides splitting based on depth, into a RenderStack
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Matrix3 from '../../../dot/js/Matrix3.js';
import Matrix4 from '../../../dot/js/Matrix4.js';
import Range from '../../../dot/js/Range.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderPlanar } from './RenderPlanar.js';
import { RenderProgram, SerializedRenderProgram } from './RenderProgram.js';
import { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { RenderableFace } from '../raster/RenderableFace.js';
import { ClippableFace } from '../cag/ClippableFace.js';
import { RenderColor } from './RenderColor.js';
import { RenderStack } from './RenderStack.js';

const toProgram = ( item: RenderPlanar ): RenderProgram => item.program;

export class RenderDepthSort extends RenderProgram {

  public constructor(
    public readonly items: RenderPlanar[]
  ) {
    const children = items.map( toProgram );

    super(
      children,
      _.every( children, RenderProgram.closureIsFullyTransparent ),
      _.some( children, RenderProgram.closureIsFullyOpaque ),
      false,
      false,
      true // NOTE: If we have this (unsplit), we'll want the centroid
    );
  }

  public override getName(): string {
    return 'RenderDepthSort';
  }

  public override withChildren( children: RenderProgram[] ): RenderDepthSort {
    assert && assert( children.length === this.items.length );
    return new RenderDepthSort( children.map( ( child, i ) => {
      return new RenderPlanar( child, this.items[ i ].pointA, this.items[ i ].pointB, this.items[ i ].pointC );
    } ) );
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    return new RenderDepthSort( this.items.map( item => item.transformed( transform ) ) );
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    let hadFullyTransparent = false;
    for ( let i = 0; i < children.length; i++ ) {
      const child = children[ i ];
      if ( child.isFullyTransparent ) {
        hadFullyTransparent = true;
        break;
      }
    }

    if ( hadFullyTransparent ) {
      const items: RenderPlanar[] = [];
      for ( let i = 0; i < children.length; i++ ) {
        const child = children[ i ];

        if ( !child.isFullyTransparent ) {
          items.push( this.items[ i ].withProgram( children[ i ] ) );
        }
      }

      if ( items.length === 0 ) {
        return RenderColor.TRANSPARENT;
      }
      else if ( items.length === 1 ) {
        return items[ 0 ].program;
      }
      else {
        return new RenderDepthSort( items );
      }
    }
    else if ( children.length < 2 ) {
      return children.length === 1 ? children[ 0 ] : RenderColor.TRANSPARENT;
    }
    else {
      return null;
    }
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    assert && assert( context.hasCentroid() );

    // Negative, so that our highest-depth things are first
    const sortedItems = _.sortBy( this.items, item => -item.getDepth( context.centroid.x, context.centroid.y ) );

    const color = Vector4.ZERO.copy(); // we will mutate it

    // Blend like normal!
    for ( let i = 0; i < sortedItems.length; i++ ) {
      const blendColor = sortedItems[ i ].program.evaluate( context );
      const backgroundAlpha = 1 - blendColor.w;

      // Assume premultiplied
      color.setXYZW(
        blendColor.x + backgroundAlpha * color.x,
        blendColor.y + backgroundAlpha * color.y,
        blendColor.z + backgroundAlpha * color.z,
        blendColor.w + backgroundAlpha * color.w
      );
    }

    return color;
  }

  public override isSplittable(): boolean {
    return true;
  }

  /**
   * The heavy lifting of figuring out what combinations of "orders" of items are possible (front-to-back), and
   * splitting into each possible non-zero-area combination.
   */
  public override split( face: RenderableFace ): RenderableFace[] {
    // TODO: add high-level documentation

    // TODO: .... actually, is there a faster algorithm for this? They are half planes, it's not like we have a combinatorial explosion?
    // TODO: I might be wrong

    // PROBABLY should have been simplified before now, potentially remove the assertion later?
    assert && assert( this.items.length >= 2, 'Should have been simplified before now' );
    if ( this.items.length < 2 ) {
      return [ face ];
    }

    if ( face.face.getArea() < 1e-8 ) {
      return [];
    }

    let maxOpaqueDepth = Infinity;

    // Fill in depth ranges, and get a max opaque depth
    const depthRanges: Range[] = [];
    for ( let i = 0; i < this.items.length; i++ ) {
      const item = this.items[ i ];
      const depthRange = item.getDepthRange( face.face );
      depthRanges.push( depthRange );
      if ( item.program.isFullyOpaque ) {
        maxOpaqueDepth = Math.min( maxOpaqueDepth, depthRange.max );
      }
    }

    // Only grab items that are not fully behind our max opaque depth
    const potentialItems: RenderPlanar[] = [];
    for ( let i = 0; i < this.items.length; i++ ) {
      const item = this.items[ i ];
      if ( depthRanges[ i ].min <= maxOpaqueDepth ) {
        potentialItems.push( item );
      }
    }

    assert && assert( potentialItems.length );

    // Every partial will have the total order between items given by its array.
    let partials = [ new SortedPartial( face.face, [ potentialItems[ 0 ] ] ) ];

    // We'll slowly add in more items while splitting.
    for ( let i = 1; i < potentialItems.length; i++ ) {
      const potentialItem = potentialItems[ i ];

      // For each partial, we'll want to examine all of the places we could insert the new item. For instance, if we
      // have 3 items in our partial right now, there will be 4 places to put our new item (before the first, between
      // others, or after the last)
      const newPartials: SortedPartial[] = [];
      for ( let j = 0; j < partials.length; j++ ) {
        const partial = partials[ j ];

        // We'll be stripping parts of the face away at a time, so we'll need to keep track of what's left
        let remainingFace = partial.face;
        for ( let k = 0; k < partial.items.length; k++ ) {
          const existingItem = partial.items[ k ];

          // TODO: We should use the above computed depthRanges to see if we can skip an actual split here.
          // TODO: Some items will be 100% in front of other items based on the ranges, and we can avoid the heavy
          // TODO: computation.

          // Partition it based on what is in front of the existing item
          const { ourFaceFront, otherFaceFront } = potentialItem.getDepthSplit( existingItem, remainingFace );

          // If the "behind" section is non-empty, we'll need to add it to our partials
          if ( otherFaceFront && otherFaceFront.getArea() > 1e-8 ) {
            newPartials.push( new SortedPartial( otherFaceFront, [
              ...partial.items.slice( 0, k ),
              potentialItem,
              ...partial.items.slice( k )
            ] ) );
          }

          if ( ourFaceFront && ourFaceFront.getArea() > 1e-8 ) {
            remainingFace = ourFaceFront;

            // If we're the last item, add the rest at the end (front).
            if ( k === partial.items.length - 1 ) {
              newPartials.push( new SortedPartial( remainingFace, [
                ...partial.items,
                potentialItem
              ] ) );
            }
          }
          else {
            break;
          }
        }
      }

      partials = newPartials;
    }

    return partials.map( partial => {
      const replacer = ( renderProgram: RenderProgram ): RenderProgram | null => {
        if ( renderProgram !== this ) {
          return null;
        }
        else {
          return new RenderStack( partial.items.map( item => item.program ) );
        }
      };

      return new RenderableFace( partial.face, face.renderProgram.replace( replacer ).simplified(), partial.face.getBounds() );
    } );
  }

  public override serialize(): SerializedRenderDepthSort {
    return {
      type: 'RenderDepthSort',
      items: this.items.map( item => {
        return {
          program: item.program.serialize(),
          pointA: [ item.pointA.x, item.pointA.y, item.pointA.z ],
          pointB: [ item.pointB.x, item.pointB.y, item.pointB.z ],
          pointC: [ item.pointC.x, item.pointC.y, item.pointC.z ]
        };
      } )
    };
  }

  public static getProjectionMatrix( near: number, far: number, minX: number, minY: number, maxX: number, maxY: number ): Matrix4 {

    const minZ = near;
    const maxZ = far;

    const diffX = maxX - minX;
    const diffY = maxY - minY;
    const diffZ = maxZ - minZ;

    return new Matrix4(
      2 * minZ / diffX, 0, -( maxX + minX ) / diffX, 0,
      0, 2 * minZ / diffY, -( maxY + minY ) / diffY, 0,
      0, 0, maxZ / diffZ, -minZ * maxZ / diffZ,
      0, 0, 1, 0
    );
  }
}

alpenglow.register( 'RenderDepthSort', RenderDepthSort );

class SortedPartial {
  public constructor(
    public readonly face: ClippableFace,
    public readonly items: RenderPlanar[] // ordered by decreasing depth (similar to eventual order in RenderStack)
  ) {}
}

export type SerializedRenderDepthSort = {
  type: 'RenderDepthSort';
  items: {
    program: SerializedRenderProgram;
    pointA: number[];
    pointB: number[];
    pointC: number[];
  }[];
};