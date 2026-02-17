// Copyright 2023-2025, University of Colorado Boulder

/**
 * Shader to bump a shader "barrier" note into the log buffer
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../../alpenglow.js';
import { wgsl, WGSLMainModule } from '../WGSLString.js';
import { logWGSL } from './logWGSL.js';

// TODO: remove the function call?
export const mainLogBarrier = (): WGSLMainModule => {
  return new WGSLMainModule( [], wgsl`
    @compute @workgroup_size(1)
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${logWGSL( {
        name: null
      } )}
    }
  ` );
};

alpenglow.register( 'mainLogBarrier', mainLogBarrier );