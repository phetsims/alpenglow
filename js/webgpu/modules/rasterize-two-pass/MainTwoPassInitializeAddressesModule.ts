// Copyright 2024-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import type { BufferSlot } from '../../compute/BufferSlot.js';
import { MAIN_TWO_PASS_INITIALIZE_ADDRESSES_DEFAULTS, mainTwoPassInitializeAddressesWGSL, mainTwoPassInitializeAddressesWGSLOptions } from '../../wgsl/rasterize-two-pass/mainTwoPassInitializeAddressesWGSL.js';
import { PipelineBlueprintOptions } from '../../compute/PipelineBlueprint.js';
import { DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions } from '../../compute/DirectModule.js';

export type MainTwoPassInitializeAddressesModuleOptions = {
  addresses: BufferSlot<number[]>;
} & mainTwoPassInitializeAddressesWGSLOptions & PipelineBlueprintOptions;

export const MAIN_TWO_PASS_INITIALIZE_ADDRESSES_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_TWO_PASS_INITIALIZE_ADDRESSES_DEFAULTS
} as const;

// inputSize: number - numBins (!)
export class MainTwoPassInitializeAddressesModule extends DirectModule<number> {

  public readonly addresses: BufferSlot<number[]>; // note: first atomic is face-allocation, second is edge-allocation

  public constructor(
    providedOptions: MainTwoPassInitializeAddressesModuleOptions
  ) {
    const options = combineOptions<MainTwoPassInitializeAddressesModuleOptions & DirectModuleOptions<number>>( {
      main: mainTwoPassInitializeAddressesWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, numBins: number ) => {
        // TODO: ensure this doesn't write PAST the end of the buffer(!)
        dispatchSize.x = Math.ceil( ( numBins + 2 ) / 256 );
      }
    }, providedOptions );

    super( options );

    this.addresses = options.addresses;
  }
}
alpenglow.register( 'MainTwoPassInitializeAddressesModule', MainTwoPassInitializeAddressesModule );