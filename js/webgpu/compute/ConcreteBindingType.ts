// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, ConcreteType } from '../../imports.js';

export default class ConcreteBindingType<T = unknown> {
  public constructor(
    public readonly bindingType: BindingType,
    public readonly concreteType: ConcreteType<T>
  ) {}
}
alpenglow.register( 'ConcreteBindingType', ConcreteBindingType );