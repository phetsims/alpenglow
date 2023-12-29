// Copyright 2023, University of Colorado Boulder

/**
 * Shader to bump a shader "barrier" note into the log buffer
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, logWGSL, PipelineBlueprint, WGSLStatements } from '../../../imports.js';

const mainLogBarrier = (
  blueprint: PipelineBlueprint
): WGSLStatements => {
  return `
    @compute @workgroup_size(1)
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${logWGSL( blueprint, {
        name: null
      } )}
    }
  `;
};

export default mainLogBarrier;

alpenglow.register( 'mainLogBarrier', mainLogBarrier );
