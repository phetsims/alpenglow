// Copyright 2024, University of Colorado Boulder

/**
 * Sets up the addresses so we (a) have atomics for the coarse pass, and (b) have the bin addresses for the fine pass
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BufferBindingType, BufferSlot, wgsl, WGSLMainModule, WGSLSlot } from '../../../imports.js';

export type mainTwoPassInitializeAddressesWGSLOptions = {
  addresses: BufferSlot<number[]>;
};

const mainTwoPassInitializeAddressesWGSL = (
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

export default mainTwoPassInitializeAddressesWGSL;