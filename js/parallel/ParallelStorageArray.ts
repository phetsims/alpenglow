// Copyright 2023, University of Colorado Boulder

/**
 * Represents a storage-level array.
 *
 * We need to track which execution threads/invocations have written to which indices, so that we can (a) ensure that
 * we won't get data races (and will have uniform control flow), and (b) in the future potentially simulate cases where
 * we might get more undefined-like behavior between which values we get.
 *
 * For storage-level arrays, we'll need to track (a) which workgroup, and (b) which local invocation within that
 * workgroup wrote to that index. When a workgroup synchronizes with storageBarrier(), it will ONLY synchronize the
 * actions that THAT SPECIFIC workgroup has done, and will leave the records of modifications from others alone.
 *
 * TODO: for NOW, we'll lock out and fail on reads (if another thread wrote), OR multiple-thread writes, HOWEVER
 * TODO: we should make it possible to return arbitrary results (and track values) for other cases
 *
 * See ParallelExecutor for more high-level documentation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BaseWorkgroupValues, ParallelContext } from '../imports.js';
import Vector3 from '../../../dot/js/Vector3.js';

export default class ParallelStorageArray<T> {

  private readonly writeLocalIDs: { local: Vector3; workgroup: Vector3 }[][];

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
      assert && assert( this.writeLocalIDs[ index ].every( id => id.local.equals( context.localId ) && id.workgroup.equals( context.workgroupId ) ) );

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
      assert && assert( this.writeLocalIDs[ index ].every( id => id.local.equals( context.localId ) && id.workgroup.equals( context.workgroupId ) ) );

      this.writeLocalIDs[ index ].push( { local: context.localId, workgroup: context.workgroupId } );

      this.data[ index ] = value;
    }

    await context.afterSet();
  }

  public synchronize( workgroupId: Vector3 ): void {
    // Clear IDs that were written from that workgroup
    for ( let i = this.writeLocalIDs.length - 1; i >= 0; i-- ) {
      const ids = this.writeLocalIDs[ i ];
      for ( let j = ids.length - 1; j >= 0; j-- ) {
        const id = ids[ j ];
        if ( id.workgroup.equals( workgroupId ) ) {
          ids.splice( j, 1 );
        }
      }
    }
  }

  public synchronizeFull(): void {
    // Clear IDs that were written from any workgroup
    this.writeLocalIDs.forEach( ids => {
      ids.length = 0;
    } );
  }
}

alpenglow.register( 'ParallelStorageArray', ParallelStorageArray );