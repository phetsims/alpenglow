// Copyright 2023, University of Colorado Boulder

/**
 * Represents a WGPU-like kernel that can be executed in parallel. Designed so that we can test WGPU-like code, but use
 * the debugging facilities of the browser to debug it.
 *
 * See ParallelExecutor for more high-level documentation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BaseWorkgroupValues, ParallelContext, ParallelStorageArray } from '../imports.js';

export default class ParallelKernel<WorkgroupValues extends BaseWorkgroupValues = Record<string, never>> {
  public constructor(
    public readonly execute: ( context: ParallelContext<WorkgroupValues> ) => Promise<void>,
    public readonly createWorkgroupValues: () => WorkgroupValues,
    public readonly storageArrays: ParallelStorageArray<unknown>[],
    public readonly workgroupX = 1,
    public readonly workgroupY = 1,
    public readonly workgroupZ = 1
  ) {}
}

alpenglow.register( 'ParallelKernel', ParallelKernel );
