// Copyright 2023-2024, University of Colorado Boulder

/**
 * Provides the ability to log a single value out
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, logWGSL, logWGSLOptions, PipelineBlueprint, wgsl, WGSLStatements, wgslString } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import WithOptional from '../../../../../phet-core/js/types/WithOptional.js';

export type logValueWGSLOptions<T> = {
  value: string; // The name!
} & WithOptional<logWGSLOptions<T>, 'name'>;

const logValueWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: logValueWGSLOptions<T>
): WGSLStatements => {

  const options = combineOptions<logWGSLOptions<T>>( {
    name: providedOptions.value,
    writeData: write => wgsl`
      ${write( wgsl`0u`, wgslString( providedOptions.value ) )}
    `,
    dataCount: 1
  }, providedOptions );

  return logWGSL( blueprint, options );
};

export default logValueWGSL;

alpenglow.register( 'logValueWGSL', logValueWGSL );
