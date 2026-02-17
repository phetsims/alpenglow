// Copyright 2023-2025, University of Colorado Boulder

/**
 * Provides the ability to log a single value out
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import WithOptional from '../../../../../phet-core/js/types/WithOptional.js';
import { alpenglow } from '../../../alpenglow.js';
import { logWGSL, logWGSLOptions } from './logWGSL.js';
import { wgsl, WGSLStatements, wgslString } from '../WGSLString.js';

export type logValueWGSLOptions<T> = {
  value: string; // The name!
} & WithOptional<logWGSLOptions<T>, 'name'>;

export const logValueWGSL = <T>(
  providedOptions: logValueWGSLOptions<T>
): WGSLStatements => {

  const options = combineOptions<logWGSLOptions<T>>( {
    name: providedOptions.value,
    writeData: write => wgsl`
      ${write( wgsl`0u`, wgslString( providedOptions.value ) )}
    `,
    dataCount: 1
  }, providedOptions );

  return logWGSL( options );
};

alpenglow.register( 'logValueWGSL', logValueWGSL );