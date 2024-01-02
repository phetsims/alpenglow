// Copyright 2023, University of Colorado Boulder

/**
 * A single level of scan (prefix sum) with configurable options.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_SCAN_DEFAULTS, mainScanWGSL, mainScanWGSLOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

// Adjust the type with BufferArraySlots. TODO cleanup API
type SelfOptions<T> = mainScanWGSLOptions<T> & ( {
  inPlace?: false;
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} | {
  inPlace: true;
  data: BufferArraySlot<T>;
} ) & ( {
  storeReduction?: false;
} | {
  storeReduction: true;
  reduction: BufferArraySlot<T>;
} ) & ( ( {
  addScannedReduction?: false;
} ) | ( {
  addScannedReduction: true;
  scannedReduction: BufferArraySlot<T>;
} & ( {
  addScannedDoubleReduction?: false;
} | {
  addScannedDoubleReduction: true;
  scannedDoubleReduction: BufferArraySlot<T>;
} ) ) ); // TODO: pass in context to lengthExpression

export type MainScanModuleOptions<T> = SelfOptions<T> & DirectModuleOptions<number>;

export const MAIN_SCAN_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_SCAN_DEFAULTS
} as const;

// stageInputSize: number
export default class MainScanModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;
  public readonly reduction: BufferArraySlot<T> | null = null;
  public readonly scannedReduction: BufferArraySlot<T> | null = null;
  public readonly scannedDoubleReduction: BufferArraySlot<T> | null = null;

  public constructor(
    options: MainScanModuleOptions<T>
  ) {
    assert && assert( !options.setup );
    options.setup = blueprint => mainScanWGSL<T>( blueprint, options );

    assert && assert( !options.setDispatchSize );
    options.setDispatchSize = ( dispatchSize: Vector3, stageInputSize: number ) => {
      dispatchSize.x = Math.ceil( stageInputSize / ( options.workgroupSize * options.grainSize ) );
    };

    super( options );

    if ( options.inPlace ) {
      this.input = options.data;
      this.output = options.data;
    }
    else {
      this.input = options.input;
      this.output = options.output;
    }

    if ( options.storeReduction ) {
      this.reduction = options.reduction;
    }
    if ( options.addScannedReduction ) {
      this.scannedReduction = options.scannedReduction;

      if ( options.addScannedDoubleReduction ) {
        this.scannedDoubleReduction = options.scannedDoubleReduction;
      }
    }
  }
}
alpenglow.register( 'MainScanModule', MainScanModule );
