// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUBindGroup
 *
 * TODO: See whether we need the wrapper or not
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BoundResource, DeviceContext } from '../imports.js';
import BindGroupLayout from './BindGroupLayout.js';

export default class BindGroup {

  public readonly bindGroup: GPUBindGroup;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly layout: BindGroupLayout,
    public readonly boundResources: BoundResource[]
  ) {

    // TODO: validation?

    this.bindGroup = deviceContext.device.createBindGroup( {
      label: `${this.name} bindGroup`,
      layout: layout.layout,
      entries: boundResources.map( boundResource => boundResource.getBindGroupEntry() )
    } );
  }
}

alpenglow.register( 'BindGroup', BindGroup );
