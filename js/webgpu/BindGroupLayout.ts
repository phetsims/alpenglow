// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUBindGroupLayout
 *
 * TODO: See whether we need the wrapper or not
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, DeviceContext } from '../imports.js';

// TODO: perhaps we can memoize layouts on the DeviceContext?
export default class BindGroupLayout {

  public readonly layout: GPUBindGroupLayout;

  // TODO: how much typing to we want here?
  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,

    // TODO: not strictly needed, but makes things easier to just have one sense of "location"
    public readonly groupIndex: number,

    // TODO: naming of each?
    public readonly boundBindings: Binding[]
  ) {
    this.layout = deviceContext.device.createBindGroupLayout( {
      label: `${name} bind group layout`,
      entries: boundBindings.map( boundBinding => boundBinding.getBindGroupLayoutEntry() )
    } );
  }
}

alpenglow.register( 'BindGroupLayout', BindGroupLayout );
