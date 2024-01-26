// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroupLayout, DeviceContext, Resource, ResourceSlot, webgpu } from '../../imports.js';

export default class BindGroup {

  public readonly bindGroup: GPUBindGroup;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly layout: BindGroupLayout,
    resourceMap: Map<ResourceSlot, Resource>
  ) {
    const entries = layout.bindings.map( binding => {
      const resource = resourceMap.get( binding.slot )!;

      return resource.getBindGroupEntry( binding );
    } );

    this.bindGroup = webgpu.deviceCreateBindGroup( deviceContext.device, {
      label: `${this.name} bind group`,
      layout: layout.layout,
      entries: entries
    } );
  }
}
alpenglow.register( 'BindGroup', BindGroup );
