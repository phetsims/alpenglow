// Copyright 2023, University of Colorado Boulder

/**
 * A specific binding location
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';

export default class BindingLocation {
  public constructor(
    public readonly groupIndex: number,
    public readonly bindingIndex: number
  ) {}

  public getWGSLAnnotation(): string {
    return `@group(${this.groupIndex}) @binding(${this.bindingIndex})`;
  }
}

alpenglow.register( 'BindingLocation', BindingLocation );
