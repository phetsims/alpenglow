// Copyright 2023-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';
import type { DeviceContext } from './DeviceContext.js';
import type { BindGroupLayout } from './BindGroupLayout.js';
import type { Resource } from './Resource.js';
import type { ResourceSlot } from './ResourceSlot.js';
import { webgpu } from '../WebGPUAPI.js';

export class BindGroup {

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