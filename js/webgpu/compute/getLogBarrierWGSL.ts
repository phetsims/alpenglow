// Copyright 2025-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
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