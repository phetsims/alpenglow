// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUPipelineLayout
 *
 * TODO: See whether we need the wrapper or not
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroupLayout, DeviceContext } from '../imports.js';

// TODO: perhaps we can memoize layouts on the DeviceContext?
export default class PipelineLayout {

  public readonly layout: GPUPipelineLayout;

  // TODO: how much typing to we want here?
  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly bindGroupLayouts: BindGroupLayout[]
  ) {
    this.layout = deviceContext.device.createPipelineLayout( {
      bindGroupLayouts: bindGroupLayouts.map( bindGroupLayout => bindGroupLayout.layout )
    } );
  }
}

alpenglow.register( 'PipelineLayout', PipelineLayout );
