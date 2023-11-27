// Copyright 2023, University of Colorado Boulder

/**
 * A TypedBuffer with a specified binding.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BoundResource, TypedBuffer } from '../imports.js';

export default class BoundBuffer<T = unknown> extends BoundResource {
  public constructor(
    public readonly typedBuffer: TypedBuffer<T>,
    binding: Binding
  ) {
    super( typedBuffer.buffer, binding );
  }
}

alpenglow.register( 'BoundBuffer', BoundBuffer );
