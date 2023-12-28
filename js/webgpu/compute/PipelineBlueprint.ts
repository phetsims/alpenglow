// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ComputePipeline, DeviceContext, PipelineLayout, ResourceUsage, WGSLContext } from '../../imports.js';

export default class PipelineBlueprint {

  public readonly context: WGSLContext;
  public readonly usages: ResourceUsage[];

  public constructor(
    public readonly name: string,
    public readonly withContext: ( context: WGSLContext ) => void, // TODO: combine this into the type(!)
    public readonly log = false
  ) {
    this.context = new WGSLContext( name, log );

    withContext( this.context );

    this.usages = this.context.getUsages(); // TODO: get rid of this forwarding
  }

  public async toComputePipeline(
    deviceContext: DeviceContext,
    pipelineLayout: PipelineLayout
  ): Promise<ComputePipeline> {
    return ComputePipeline.withContextAsync(
      deviceContext,
      this.name,
      this.context.toString( pipelineLayout ),
      pipelineLayout,
      this.log
    );
  }
}
alpenglow.register( 'PipelineBlueprint', PipelineBlueprint );
