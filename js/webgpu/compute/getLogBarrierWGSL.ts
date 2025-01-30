// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { PipelineLayout } from './PipelineLayout.js';
import { PipelineBlueprint } from './PipelineBlueprint.js';
import { mainLogBarrier } from '../wgsl/gpu/mainLogBarrier.js';
import { partialWGSLBeautify, stripWGSLComments } from '../wgsl/WGSLUtils.js';

export const getLogBarrierWGSL = (
  pipelineLayout: PipelineLayout
): string => {
  // TODO: remove the superfluous main add
  const logBarrierPipelineBlueprint = new PipelineBlueprint( {
    name: 'logBarrier',
    log: true
  } );
  mainLogBarrier().withBlueprint( logBarrierPipelineBlueprint );
  return partialWGSLBeautify( stripWGSLComments( logBarrierPipelineBlueprint.toString( pipelineLayout ) ) );
};