// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BindingDescriptor, BindingLocation, BufferBinding, BufferSlot, DeviceContext, ResourceSlot, webgpu } from '../../imports.js';

export default class BindGroupLayout {
  public readonly layout: GPUBindGroupLayout;
  public readonly bindings: Binding[];

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly groupIndex: number,
    public readonly bindingDescriptors: BindingDescriptor[]
  ) {
    this.layout = webgpu.deviceCreateBindGroupLayout( deviceContext.device, {
      label: `${name} bind group layout`,
      entries: bindingDescriptors.map( binding => binding.getBindGroupLayoutEntry() )
    } );

    this.bindings = bindingDescriptors.map( bindingDescriptor => {
      const location = new BindingLocation( groupIndex, bindingDescriptor.bindingIndex );

      if ( bindingDescriptor.slot instanceof BufferSlot ) {
        return new BufferBinding(
          location, bindingDescriptor.bindingType, bindingDescriptor.slot
        );
      }
      else {
        return new Binding(
          location, bindingDescriptor.bindingType, bindingDescriptor.slot
        );
      }
    } );
  }

  public hasBindingWithSlot( slot: ResourceSlot ): boolean {
    return this.bindings.some( binding => binding.slot === slot );
  }

  public getBindingFromSlot( slot: ResourceSlot ): Binding | null {
    return this.bindings.find( binding => binding.slot === slot ) || null;
  }
}
alpenglow.register( 'BindGroupLayout', BindGroupLayout );
