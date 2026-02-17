// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
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