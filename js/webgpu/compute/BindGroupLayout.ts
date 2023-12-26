// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BindingDescriptor, BindingLocation, ConcreteBufferSlot, DeviceContext, ResourceSlot } from '../../imports.js';

export default class BindGroupLayout {
  public readonly layout: GPUBindGroupLayout;
  public readonly bindings: Binding[];

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly groupIndex: number,
    public readonly bindingDescriptors: BindingDescriptor[]
  ) {
    this.layout = deviceContext.device.createBindGroupLayout( {
      label: `${name} bind group layout`,
      entries: bindingDescriptors.map( binding => binding.getBindGroupLayoutEntry() )
    } );

    this.bindings = bindingDescriptors.map( binding => new Binding(
      new BindingLocation( groupIndex, binding.bindingIndex ), binding.bindingType, binding.slot
    ) );
  }

  public getBindingFromSlot( slot: ResourceSlot ): Binding | null {
    return this.bindings.find( binding => binding.slot === slot ) || null;
  }

  public getConcreteBindingFromSlot<T>( slot: ConcreteBufferSlot<T> ): Binding | null {
    return this.getBindingFromSlot( slot );
  }
}
alpenglow.register( 'BindGroupLayout', BindGroupLayout );
