// Copyright 2023-2025, University of Colorado Boulder

/**
 * A specific binding location
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';
import { decimalS, wgsl, WGSLString } from '../wgsl/WGSLString.js';

export class BindingLocation {
  public constructor(
    public readonly groupIndex: number,
    public readonly bindingIndex: number
  ) {}

  public getWGSLAnnotation(): WGSLString {
    return wgsl`@group(${decimalS( this.groupIndex )}) @binding(${decimalS( this.bindingIndex )})`;
  }
}

alpenglow.register( 'BindingLocation', BindingLocation );