// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ComputePipeline, DeviceContext, PipelineLayout, ResourceUsage } from '../../imports.js';

export default class PipelineBlueprint {
  public constructor(
    public readonly name: string,
    public readonly usages: ResourceUsage[],
    public readonly toComputePipeline: (
      context: DeviceContext, name: string, pipelineLayout: PipelineLayout
    ) => Promise<ComputePipeline>
  ) {}
}
alpenglow.register( 'PipelineBlueprint', PipelineBlueprint );
