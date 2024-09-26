// Copyright 2023-2024, University of Colorado Boulder

/**
 * Executes a kernel in parallel, using async/await to simulate the WGPU execution model.
 *
 * Designed so that we can test WGPU-like code, but use the debugging facilities of the browser to debug it.
 *
 * We'll randomly choose which item to execute next, so that as much as possible things are executed with a random order
 *
 * Things are structured so that execution thread functions will:
 * - await context.start() - at the very start of the call
 * - await all of the inter-thread primitives (like get/set)
 * - resolve when complete
 *
 * Thus the executor will keep ONE thread going at a time, and every time one of those actions is taken, we'll toss
 * the function to resolve that in a list (with the others), and will randomly choose which one to resolve next.
 * This will execute things with a fairly random order.
 *
 * (needs a working knowledge of the WGSL execution model to understand)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BaseWorkgroupValues, ParallelContext, ParallelKernel, ParallelWorkgroup, ParallelWorkgroupArray } from '../imports.js';
import Random from '../../../dot/js/Random.js';
import Vector3 from '../../../dot/js/Vector3.js';

// eslint-disable-next-line phet/bad-sim-text
const random = new Random();

const LOG = false;

export default class ParallelExecutor<WorkgroupValues extends BaseWorkgroupValues> {

  // A list of functions to call when we're ready to execute the next item.
  // Each one will resolve a promise that one kernel execution thread is waiting on, which SHOULD trigger another
  // method on this executor (OR will resolve the promise for the kernel execution thread).
  public readonly resolves: ( () => void )[] = [];

  // All of the promises returned by the async kernel execution thread functions. When all of these are done, our
  // dispatch is complete (and dispatch() will resolve shortly thereafter).
  public readonly donePromises: Promise<void>[] = [];

  public constructor(
    public readonly kernel: ParallelKernel<WorkgroupValues>
  ) {}

  // Execute the kernel in parallel, with the given dispatch dimensions (controls how many workgroups there are)
  public async dispatch(
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1
  ): Promise<void> {

    // For each workgroup
    for ( let workgroupX = 0; workgroupX < dispatchX; workgroupX++ ) {
      for ( let workgroupY = 0; workgroupY < dispatchY; workgroupY++ ) {
        for ( let workgroupZ = 0; workgroupZ < dispatchZ; workgroupZ++ ) {
          // Create the workgroup
          const workgroup = new ParallelWorkgroup( this.kernel, new Vector3(
            workgroupX, workgroupY, workgroupZ
          ), this.kernel.createWorkgroupValues() );

          // For each invocation (execution thread) in the workgroup
          for ( let localX = 0; localX < this.kernel.workgroupX; localX++ ) {
            for ( let localY = 0; localY < this.kernel.workgroupY; localY++ ) {
              for ( let localZ = 0; localZ < this.kernel.workgroupZ; localZ++ ) {
                const localId = new Vector3( localX, localY, localZ );

                const context = new ParallelContext( this.kernel, localId, workgroup, this );

                // "queue" up execution. THESE SHOULD START with a call to `await context.start()`, so it won't actually
                // truly start yet.
                const donePromise = this.kernel.execute( context );
                this.donePromises.push( donePromise );

                // When we reach the end of an execution thread, we'll need to keep our execution going.
                donePromise.then( () => { // eslint-disable-line @typescript-eslint/no-floating-promises
                  LOG && console.log( `DONE: workgroup: ${workgroupX},${workgroupY},${workgroupZ} local: ${localX},${localY},${localZ}` );
                  this.next();
                } );
              }
            }
          }
        }
      }
    }

    // Kick off initial execution (of one thread)
    this.next();

    // Wait for all of the threads to finish
    await Promise.all( this.donePromises );

    // At the end, we'll mark all of the storage arrays as fully synchronized (since this happens between dispatch
    // stages at WGPU anyway).
    this.kernel.storageArrays.forEach( storageArray => storageArray.synchronizeFull() );
  }

  /**
   * Kick off the next pending execution thread action.
   */
  public next(): void {
    if ( this.resolves.length > 0 ) {
      LOG && console.log( '(next)' );
      const resolve = random.sample( this.resolves );
      this.resolves.splice( this.resolves.indexOf( resolve ), 1 );
      resolve();
    }
  }

  /**
   * Called from execution threads at the start of their execution. We'll pause all of them until we're ready to
   * proceed.
   */
  public start(): Promise<void> {
    return new Promise<void>( resolve => {
      // this.resolves.push( resolve );
      this.resolves.push( () => {
        LOG && console.log( 'START' );
        resolve();
      } );
    } );
  }

  // Called from execution threads through the context
  public workgroupBarrier( workgroup: ParallelWorkgroup<WorkgroupValues> ): Promise<void> {
    return new Promise<void>( resolve => {
      workgroup.workgroupResolves.push( resolve );
      if ( workgroup.workgroupResolves.length === this.kernel.workgroupX * this.kernel.workgroupY * this.kernel.workgroupZ ) {
        workgroup.workgroupResolves.forEach( resolve => {
          // this.resolves.push( resolve );
          this.resolves.push( () => {
            LOG && console.log( 'WORKGROUP BARRIER' );
            resolve();
          } );
        } );
        workgroup.workgroupResolves.length = 0;

        // Synchronize the workgroup arrays
        Object.keys( workgroup.values ).forEach( key => {
          const value = workgroup.values[ key ];
          if ( value instanceof ParallelWorkgroupArray ) {
            value.synchronize( workgroup.id );
          }
        } );
      }

      this.next();
    } );
  }

  // Called from execution threads through the context
  public storageBarrier( workgroup: ParallelWorkgroup<WorkgroupValues> ): Promise<void> {
    return new Promise<void>( resolve => {
      workgroup.storageResolves.push( resolve );
      if ( workgroup.storageResolves.length === this.kernel.workgroupX * this.kernel.workgroupY * this.kernel.workgroupZ ) {
        workgroup.storageResolves.forEach( resolve => {
          // this.resolves.push( resolve );
          this.resolves.push( () => {
            LOG && console.log( 'STORAGE BARRIER' );
            resolve();
          } );
        } );
        workgroup.storageResolves.length = 0;

        // Synchronize the storage arrays
        this.kernel.storageArrays.forEach( storageArray => storageArray.synchronize( workgroup.id ) );
      }

      this.next();
    } );
  }

  // Called indirectly from execution threads through the context (when they set a value in a storage/workgroup array)
  public afterSet(): Promise<void> {
    return new Promise<void>( resolve => {
      // this.resolves.push( resolve );
      this.resolves.push( () => {
        LOG && console.log( 'AFTER SET' );
        resolve();
      } );

      this.next();
    } );
  }

  // Called indirectly from execution threads through the context (when they get a value in a storage/workgroup array)
  public afterGet(): Promise<void> {
    return new Promise<void>( resolve => {
      // this.resolves.push( resolve );
      this.resolves.push( () => {
        LOG && console.log( 'AFTER GET' );
        resolve();
      } );

      this.next();
    } );
  }
}

alpenglow.register( 'ParallelExecutor', ParallelExecutor );