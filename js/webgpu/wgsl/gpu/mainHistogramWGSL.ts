// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferBindingType, BufferSlot, histogramWGSL, OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS, OptionalLengthExpressionable, PipelineBlueprint, RakedSizable, u32, unrollWGSL, WGSLExpressionT, WGSLExpressionU32 } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type mainHistogramWGSLOptions<T> = {
  input: BufferSlot<T[]>;
  output: BufferSlot<number[]>;

  numBins: number;
  getBin: ( blueprint: PipelineBlueprint, value: WGSLExpressionT ) => WGSLExpressionU32;
} & OptionalLengthExpressionable & RakedSizable;

export const MAIN_HISTOGRAM_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS
} as const;

const mainHistogramWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: mainHistogramWGSLOptions<T>
): void => {

  const options = optionize3<mainHistogramWGSLOptions<T>>()( {}, MAIN_HISTOGRAM_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const numBins = options.numBins;
  const getBin = options.getBin;
  const lengthExpression = options.lengthExpression;

  // TODO: local_id.x should use LocalIndexable?

  blueprint.addSlot( 'mhist_input', options.input, BufferBindingType.READ_ONLY_STORAGE );
  blueprint.addSlot( 'mhist_output', options.output, BufferBindingType.STORAGE );

  blueprint.add( 'main', `
    var<workgroup> histogram_scratch: array<atomic<u32>, ${numBins}>;
    
    @compute @workgroup_size(${workgroupSize})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
    
      ${histogramWGSL( blueprint, {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        histogramScratch: 'histogram_scratch',
        getBin: ( blueprint, index ) => getBin( blueprint, `mhist_input[ ${index} ]` ),
        lengthExpression: lengthExpression
      } )}
    
      workgroupBarrier();
    
      // coalesced atomics
      ${unrollWGSL( 0, Math.ceil( numBins / workgroupSize ), i => `
        {
          let mhist_index = ${u32( workgroupSize * i )} + local_id.x;
          if ( mhist_index < ${u32( numBins )} ) {
            atomicAdd( &mhist_output[ mhist_index ], atomicLoad( &histogram_scratch[ mhist_index ] ) );
          }
        }
      ` )}
    }
  ` );
};

export default mainHistogramWGSL;

alpenglow.register( 'mainHistogramWGSL', mainHistogramWGSL );
