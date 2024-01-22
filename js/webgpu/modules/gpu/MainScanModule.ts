// Copyright 2024, University of Colorado Boulder

/**
 * A single level of scan (prefix sum) with configurable options.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_SCAN_DEFAULTS, mainScanWGSL, mainScanWGSLOptions, PipelineBlueprintOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';

export type MainScanModuleOptions<T> = {
  input?: BufferArraySlot<T> | null;
  output?: BufferArraySlot<T> | null;
  data?: BufferArraySlot<T> | null;
  reduction?: BufferArraySlot<T> | null;
  scannedReduction?: BufferArraySlot<T> | null;
  scannedDoubleReduction?: BufferArraySlot<T> | null;
} & mainScanWGSLOptions<T> & PipelineBlueprintOptions;

export const MAIN_SCAN_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_SCAN_DEFAULTS
} as const;

// inputSize: number
export default class MainScanModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;
  public readonly reduction: BufferArraySlot<T> | null = null;
  public readonly scannedReduction: BufferArraySlot<T> | null = null;
  public readonly scannedDoubleReduction: BufferArraySlot<T> | null = null;

  public constructor(
    providedOptions: MainScanModuleOptions<T>
  ) {
    const options = combineOptions<MainScanModuleOptions<T> & DirectModuleOptions<number>>( {
      main: mainScanWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, inputSize: number ) => {
        dispatchSize.x = Math.ceil( inputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
      }
    }, providedOptions );

    super( options );

    if ( options.inPlace ) {
      assert && assert( options.data );
      this.input = options.data!;
      this.output = options.data!;
    }
    else {
      assert && assert( options.input );
      assert && assert( options.output );
      this.input = options.input!;
      this.output = options.output!;
    }

    if ( options.storeReduction ) {
      assert && assert( options.reduction );
      this.reduction = options.reduction!;
    }
    if ( options.addScannedReduction ) {
      assert && assert( options.scannedReduction );
      this.scannedReduction = options.scannedReduction!;

      if ( options.addScannedDoubleReduction ) {
        assert && assert( options.scannedDoubleReduction );
        this.scannedDoubleReduction = options.scannedDoubleReduction!;
      }
    }
  }
}
alpenglow.register( 'MainScanModule', MainScanModule );
