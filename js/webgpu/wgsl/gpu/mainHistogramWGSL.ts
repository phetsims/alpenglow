// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferBindingType, BufferSlot, decimalS, histogramWGSL, OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS, OptionalLengthExpressionable, RakedSizable, u32S, unrollWGSL, wgsl, WGSLExpressionT, WGSLExpressionU32, WGSLMainModule, WGSLSlot } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type mainHistogramWGSLOptions<T> = {
  input: BufferSlot<T[]>;
  output: BufferSlot<number[]>;

  numBins: number;
  getBin: ( value: WGSLExpressionT ) => WGSLExpressionU32;
} & OptionalLengthExpressionable & RakedSizable;

export const MAIN_HISTOGRAM_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS
} as const;

const mainHistogramWGSL = <T>(
  providedOptions: mainHistogramWGSLOptions<T>
): WGSLMainModule => {

  const options = optionize3<mainHistogramWGSLOptions<T>>()( {}, MAIN_HISTOGRAM_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const numBins = options.numBins;
  const getBin = options.getBin;
  const lengthExpression = options.lengthExpression;

  // TODO: local_id.x should use LocalIndexable?

  return new WGSLMainModule( [
    new WGSLSlot( 'mhist_input', options.input, BufferBindingType.READ_ONLY_STORAGE ),
    new WGSLSlot( 'mhist_output', options.output, BufferBindingType.STORAGE )
  ], wgsl`
    var<workgroup> histogram_scratch: array<atomic<u32>, ${decimalS( numBins )}>;
    
    @compute @workgroup_size(${decimalS( workgroupSize )})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
    
      ${histogramWGSL( {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        histogramScratch: wgsl`histogram_scratch`,
        getBin: index => getBin( wgsl`mhist_input[ ${index} ]` ),
        lengthExpression: lengthExpression
      } )}
    
      workgroupBarrier();
    
      // coalesced atomics
      ${unrollWGSL( 0, Math.ceil( numBins / workgroupSize ), i => wgsl`
        {
          let mhist_index = ${u32S( workgroupSize * i )} + local_id.x;
          if ( mhist_index < ${u32S( numBins )} ) {
            atomicAdd( &mhist_output[ mhist_index ], atomicLoad( &histogram_scratch[ mhist_index ] ) );
          }
        }
      ` )}
    }
  ` );
};

export default mainHistogramWGSL;

alpenglow.register( 'mainHistogramWGSL', mainHistogramWGSL );