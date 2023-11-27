// Copyright 2023, University of Colorado Boulder

/**
 * A binding with a location
 *
 * TODO: Eventually, Binding will just be this?
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BindingLocation } from '../imports.js';

export default class BoundBinding {
  public constructor(
    public readonly binding: Binding,
    public readonly location: BindingLocation
  ) {}

  public getBindGroupLayoutEntry(): GPUBindGroupLayoutEntry {
    return this.binding.getBindGroupLayoutEntry( this.location.bindingIndex );
  }
}

alpenglow.register( 'BoundBinding', BoundBinding );
