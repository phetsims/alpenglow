// Copyright 2024-2026, University of Colorado Boulder

/**
 * Sets up the addresses so we (a) have atomics for the coarse pass, and (b) have the bin addresses for the fine pass
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { BufferSlot } from '../../compute/BufferSlot.js';
import { wgsl, WGSLMainModule, WGSLSlot } from '../WGSLString.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';

export type mainTwoPassInitializeAddressesWGSLOptions = {
  addresses: BufferSlot<number[]>;
};

export const MAIN_TWO_PASS_INITIALIZE_ADDRESSES_DEFAULTS = {
  // placeholder
} as const;

export const mainTwoPassInitializeAddressesWGSL = (
  options: mainTwoPassInitializeAddressesWGSLOptions
): WGSLMainModule => {

  const addressesSlot = new WGSLSlot( 'addresses', options.addresses, BufferBindingType.STORAGE );

  return new WGSLMainModule( [
    addressesSlot
  ], wgsl`
    @compute @workgroup_size(256)
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      addresses[ global_id.x ] = select( 0u, 0xffffffffu, global_id.x >= 2u );
    }
  ` );
};