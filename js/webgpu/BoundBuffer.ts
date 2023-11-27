// Copyright 2023, University of Colorado Boulder

/**
 * A TypedBuffer with a specified binding.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BoundBinding, TypedBuffer } from '../imports.js';

export default class BoundBuffer<T> {
  public constructor(
    public readonly typedBuffer: TypedBuffer<T>,
    public readonly boundBinding: BoundBinding
  ) {}
}

alpenglow.register( 'BoundBuffer', BoundBuffer );
