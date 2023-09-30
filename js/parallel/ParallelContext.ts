// Copyright 2023, University of Colorado Boulder

/**
 * Contains all the data/methods needed by a kernel to run in parallel. Passed to the kernel execution function, so that
 * it can make equivalent calls similar to the WGPU calls.
 *
 * See ParallelExecutor for more high-level documentation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelWorkgroup, ParallelWorkgroupArray } from '../imports.js';
import Vector3 from '../../../dot/js/Vector3.js';

export type BaseWorkgroupValues = Record<string, ParallelWorkgroupArray<unknown> | number>;

export default class ParallelContext<WorkgroupValues extends BaseWorkgroupValues> {

  public readonly globalId: Vector3;
  public readonly localIndex: number;
  public readonly workgroupId: Vector3;
  public readonly workgroupValues: WorkgroupValues;

  public constructor(
    public readonly kernel: ParallelKernel<WorkgroupValues>,
    public readonly localId: Vector3,
    public readonly workgroup: ParallelWorkgroup<WorkgroupValues>,
    public readonly executor: ParallelExecutor<WorkgroupValues>
  ) {
    this.workgroupId = workgroup.id;

    this.globalId = new Vector3(
      localId.x + this.workgroupId.x * kernel.workgroupX,
      localId.y + this.workgroupId.y * kernel.workgroupY,
      localId.z + this.workgroupId.z * kernel.workgroupZ
    );

    this.localIndex = localId.x + localId.y * kernel.workgroupX + localId.z * kernel.workgroupX * kernel.workgroupY;

    this.workgroupValues = workgroup.values;
  }

  // To be called from within the kernel execution function
  public async start(): Promise<void> {
    return this.executor.start();
  }

  // To be called from within the kernel execution function
  public async workgroupBarrier(): Promise<void> {
    return this.executor.workgroupBarrier( this.workgroup );
  }

  // To be called from within the kernel execution function
  public async storageBarrier(): Promise<void> {
    return this.executor.storageBarrier( this.workgroup );
  }

  // TODO: workgroupUniformLoad

  // To be called from within the kernel execution function
  public async afterSet(): Promise<void> {
    return this.executor.afterSet();
  }

  // To be called from within the kernel execution function
  public async afterGet(): Promise<void> {
    return this.executor.afterGet();
  }
}

alpenglow.register( 'ParallelContext', ParallelContext );
