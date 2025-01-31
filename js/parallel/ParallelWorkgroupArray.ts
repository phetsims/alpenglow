// Copyright 2023-2025, University of Colorado Boulder

/**
 * Represents a storage-level array.
 *
 * We need to track which execution threads/invocations have written to which indices, so that we can (a) ensure that
 * we won't get data races (and will have uniform control flow), and (b) in the future potentially simulate cases where
 * we might get more undefined-like behavior between which values we get.
 *
 * For workgroup-level arrays, we only need to track the local invocation within that workgroup wrote to that index.
 *
 * TODO: for NOW, we'll lock out and fail on reads (if another thread wrote), OR multiple-thread writes, HOWEVER
 * TODO: we should make it possible to return arbitrary results (and track values) for other cases
 *
 * See ParallelExecutor for more high-level documentation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector3 from '../../../dot/js/Vector3.js';
import { alpenglow } from '../alpenglow.js';
import type { BaseWorkgroupValues, ParallelContext } from './ParallelContext.js';

export class ParallelWorkgroupArray<T> {

  private readonly writeLocalIDs: Vector3[][];

  public constructor(
    public readonly data: T[],
    public readonly indeterminateValue: T
  ) {
    this.writeLocalIDs = data.map( () => [] );
  }

  public async get<WorkgroupValues extends BaseWorkgroupValues>(
    context: ParallelContext<WorkgroupValues>,
    index: number
  ): Promise<T> {
    let value: T;

    if ( !isFinite( index ) || index < 0 || index >= this.data.length ) {
      value = this.indeterminateValue;
    }
    else {
      // Ensure that we're the only ones who have written to this
      assert && assert( this.writeLocalIDs[ index ].every( id => id.equals( context.localId ) ) );

      value = this.data[ index ];
    }

    await context.afterGet();

    return value;
  }

  public async set<WorkgroupValues extends BaseWorkgroupValues>(
    context: ParallelContext<WorkgroupValues>,
    index: number,
    value: T
  ): Promise<void> {
    if ( isFinite( index ) && index >= 0 && index < this.data.length ) {
      // Ensure that we're the only ones who have written to this
      assert && assert( this.writeLocalIDs[ index ].every( id => id.equals( context.localId ) ) );

      this.writeLocalIDs[ index ].push( context.localId );

      this.data[ index ] = value;
    }

    await context.afterSet();
  }

  public synchronize( workgroupId: Vector3 ): void {
    // TODO: assert that we're in the same workgroup?

    // Clear IDs that were written
    this.writeLocalIDs.forEach( ids => {
      ids.length = 0;
    } );
  }
}

alpenglow.register( 'ParallelWorkgroupArray', ParallelWorkgroupArray );