// Copyright 2023, University of Colorado Boulder

/**
 * A TypedBuffer with a specified binding.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding } from '../imports.js';

export default class BoundResource<T> {
  public constructor(
    // TODO This seems off!
    public readonly resource: GPUBuffer | GPUTextureView,
    public readonly binding: Binding<T>
  ) {}

  public getBindGroupEntry(): GPUBindGroupEntry {
    return this.binding.getBindGroupEntry( this.resource );
  }
}

alpenglow.register( 'BoundResource', BoundResource );
