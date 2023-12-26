// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroupLayout, Binding, ConcreteBufferSlot, DeviceContext, ResourceSlot } from '../../imports.js';

export default class PipelineLayout {
  public readonly layout: GPUPipelineLayout;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly bindGroupLayouts: BindGroupLayout[]
  ) {
    this.layout = deviceContext.device.createPipelineLayout( {
      bindGroupLayouts: bindGroupLayouts.map( bindGroupLayout => bindGroupLayout.layout )
    } );
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

  public getConcreteBindingFromSlot<T>( slot: ConcreteBufferSlot<T> ): Binding {
    return this.getBindingFromSlot( slot );
  }
}
alpenglow.register( 'PipelineLayout', PipelineLayout );
