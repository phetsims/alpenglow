// Copyright 2023-2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BitOrder, BufferBindingType, BufferSlot, decimalS, PipelineBlueprint, radixHistogramWGSL, wgsl, WGSLExpressionU32 } from '../../../imports.js';

export type mainRadixHistogramWGSLOptions<T> = {
  input: BufferSlot<T[]>;
  output: BufferSlot<number[]>;

  workgroupSize: number;
  grainSize: number;

  order: BitOrder<T>;

  pass: number;
  bitsPerPass: number;

  lengthExpression: WGSLExpressionU32; // TODO: support optional
};

export const MAIN_RADIX_HISTOGRAM_DEFAULTS = {
  // TODO: will need something once we have lengthExpression optional
} as const;

const mainRadixHistogramWGSL = <T>(
  blueprint: PipelineBlueprint,
  options: mainRadixHistogramWGSLOptions<T>
): void => {

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const order = options.order;
  const pass = options.pass;
  const bitsPerPass = options.bitsPerPass;
  const lengthExpression = options.lengthExpression;

  blueprint.addSlot( 'input', options.input, BufferBindingType.READ_ONLY_STORAGE );
  blueprint.addSlot( 'output', options.output, BufferBindingType.STORAGE ); // TODO: make sure this is u32

  blueprint.add( 'main', wgsl`
    var<workgroup> histogram_scratch: array<atomic<u32>, ${decimalS( 1 << bitsPerPass )}>;
    
    @compute @workgroup_size(${decimalS( workgroupSize )})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${radixHistogramWGSL( blueprint, {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        histogramScratch: wgsl`histogram_scratch`,
        getBin: index => order.getBitsWGSL( wgsl`input[ ${index} ]`, pass * bitsPerPass, bitsPerPass ), // TODO: consider rename of getBin
        numBins: ( 1 << bitsPerPass ),
        lengthExpression: lengthExpression,
        storeHistogram: ( index, value ) => wgsl`output[ ${index} ] = ${value};`
      } )}
    }
  ` );
};

export default mainRadixHistogramWGSL;

alpenglow.register( 'mainRadixHistogramWGSL', mainRadixHistogramWGSL );
