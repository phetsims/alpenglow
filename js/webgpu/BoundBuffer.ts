// Copyright 2023, University of Colorado Boulder

/**
 * A TypedBuffer with a specified binding.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BoundBinding, BoundResource, TypedBuffer } from '../imports.js';

export default class BoundBuffer<T = unknown> extends BoundResource {
  public constructor(
    public readonly typedBuffer: TypedBuffer<T>,
    boundBinding: BoundBinding
  ) {
    super( typedBuffer.buffer, boundBinding );
  }
}

alpenglow.register( 'BoundBuffer', BoundBuffer );
