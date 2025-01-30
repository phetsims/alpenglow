// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import type { DeviceContext } from './DeviceContext.js';
import type { BindGroupLayout } from './BindGroupLayout.js';
import { webgpu } from '../WebGPUAPI.js';
import type { ResourceSlot } from './ResourceSlot.js';
import type { Binding } from './Binding.js';

export class PipelineLayout {
  public readonly layout: GPUPipelineLayout;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly bindGroupLayouts: BindGroupLayout[]
  ) {
    this.layout = webgpu.deviceCreatePipelineLayout( deviceContext.device, {
      bindGroupLayouts: bindGroupLayouts.map( bindGroupLayout => bindGroupLayout.layout )
    } );
  }

  public hasBindingWithSlot( slot: ResourceSlot ): boolean {
    for ( let i = 0; i < this.bindGroupLayouts.length; i++ ) {
      if ( this.bindGroupLayouts[ i ].hasBindingWithSlot( slot ) ) {
        return true;
      }
    }
    return false;
  }

  public getBindingFromSlot( slot: ResourceSlot ): Binding {
    let binding: Binding | null = null;
    for ( let i = 0; i < this.bindGroupLayouts.length; i++ ) {
      binding = this.bindGroupLayouts[ i ].getBindingFromSlot( slot );
      if ( binding ) {
        break;
      }
    }

    assert && assert( binding );
    return binding!;
  }
}
alpenglow.register( 'PipelineLayout', PipelineLayout );