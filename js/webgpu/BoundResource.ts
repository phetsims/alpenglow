// Copyright 2023, University of Colorado Boulder

/**
 * A TypedBuffer with a specified binding.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BoundBinding } from '../imports.js';

export default class BoundResource {
  public constructor(
    public readonly resource: GPUBuffer | GPUTextureView,
    public readonly boundBinding: BoundBinding
  ) {}

  public getBindGroupEntry(): GPUBindGroupEntry {
    return this.boundBinding.getBindGroupEntry( this.resource );
  }
}

alpenglow.register( 'BoundResource', BoundResource );
