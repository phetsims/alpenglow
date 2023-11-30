// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BitOrder, radixHistogramWGSL, WGSLContext, WGSLExpressionU32, WGSLModuleDeclarations } from '../../../imports.js';

export type mainRadixHistogramWGSLOptions<T> = {
  workgroupSize: number;
  grainSize: number;

  order: BitOrder<T>;

  pass: number;
  bitsPerPass: number;

  lengthExpression: WGSLExpressionU32; // TODO: support optional

  bindings: {
    input: Binding;
    output: Binding;
  };
};

const mainRadixHistogramWGSL = <T>(
  // TODO: context pass-through for more functions?
  context: WGSLContext,
  options: mainRadixHistogramWGSLOptions<T>
): WGSLModuleDeclarations => {

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const order = options.order;
  const pass = options.pass;
  const bitsPerPass = options.bitsPerPass;
  const lengthExpression = options.lengthExpression;
  const bindings = options.bindings;

  return `
    ${bindings.input.location.getWGSLAnnotation()}
    var<storage, ${bindings.input.getStorageAccess()}> input: array<${order.type.valueType}>;
    ${bindings.output.location.getWGSLAnnotation()}
    var<storage, ${bindings.output.getStorageAccess()}> output: array<u32>;
    
    var<workgroup> histogram_scratch: array<atomic<u32>, ${1 << bitsPerPass}>;
    
    @compute @workgroup_size(${workgroupSize})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${radixHistogramWGSL( context, {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        histogramScratch: 'histogram_scratch',
        getBin: index => order.getBitsWGSL( `input[ ${index} ]`, pass * bitsPerPass, bitsPerPass ), // TODO: consider rename of getBin
        numBins: ( 1 << bitsPerPass ),
        lengthExpression: lengthExpression,
        storeHistogram: ( index, value ) => `output[ ${index} ] = ${value};`
      } )}
    }
  `;
};

export default mainRadixHistogramWGSL;

alpenglow.register( 'mainRadixHistogramWGSL', mainRadixHistogramWGSL );
