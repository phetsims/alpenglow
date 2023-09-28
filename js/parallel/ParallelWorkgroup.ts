// Copyright 2023, University of Colorado Boulder

/**
 * Represents a workgroup
 *
 * See ParallelExecutor for more high-level documentation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BaseWorkgroupValues, ParallelKernel } from '../imports.js';
import Vector3 from '../../../dot/js/Vector3.js';

export default class ParallelWorkgroup<WorkgroupValues extends BaseWorkgroupValues> {

  public workgroupResolves: ( () => void )[] = [];
  public storageResolves: ( () => void )[] = [];

  public constructor(
    public readonly kernel: ParallelKernel<WorkgroupValues>,
    public readonly id: Vector3,
    public readonly values: WorkgroupValues
  ) {}
}

alpenglow.register( 'ParallelWorkgroup', ParallelWorkgroup );
