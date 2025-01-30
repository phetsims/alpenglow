// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import type { BindingType } from './BindingType.js';
import type { ConcreteType } from './ConcreteType.js';

export class ConcreteBindingType<T = unknown> {
  public constructor(
    public readonly bindingType: BindingType,
    public readonly concreteType: ConcreteType<T>
  ) {}
}
alpenglow.register( 'ConcreteBindingType', ConcreteBindingType );