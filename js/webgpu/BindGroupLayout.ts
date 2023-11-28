// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUBindGroupLayout.
 *
 * Provides a "name => Binding" map that can be combined and used by other tools.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, DeviceContext } from '../imports.js';

// TODO: perhaps we can memoize layouts on the DeviceContext?
export default class BindGroupLayout<BindingMap extends Record<string, Binding | null>> {

  public readonly layout: GPUBindGroupLayout;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly groupIndex: number, // TODO: consider whether to ditch this or not

    // This is a map from strings to Bindings (where null is accepted, and is treated as a "gap" for
    // conditionally-enabled things). It should include all of the bindings for the BindGroupLayout
    public readonly bindingMap: BindingMap
  ) {
    assert && assert( Object.keys( bindingMap ).every( name => {
      const binding = bindingMap[ name ];
      return binding === null || binding.location.groupIndex === groupIndex;
    } ), 'Binding groupIndex mismatch' );

    this.layout = deviceContext.device.createBindGroupLayout( {
      label: `${name} bind group layout`,
      entries: Object.keys( bindingMap ).filter( name => bindingMap[ name ] !== null ).map( name => bindingMap[ name ]!.getBindGroupLayoutEntry() )
    } );
  }
}

alpenglow.register( 'BindGroupLayout', BindGroupLayout );
