// Copyright 2023-2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BitOrder, BufferBindingType, BufferSlot, ceilDivideConstantDivisorWGSL, commentWGSL, conditionalIfWGSL, loadMultipleWGSL, loadMultipleWGSLOptions, logRakedWGSL, logStringWGSL, logValueWGSL, nBitCompactSingleSortWGSL, PipelineBlueprint, RakedSizable, scanRakedWGSL, u32, U32Max, U32Type, unrollWGSL, WGSLExpressionT, WGSLExpressionU32 } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

export type mainRadixScatterWGSLOptions<T> = {
  input: BufferSlot<T[]>;
  histogramOffsets: BufferSlot<number[]>;
  output: BufferSlot<T[]>;

  order: BitOrder<T>;

  pass: number;
  bitsPerPass: number;
  bitsPerInnerPass: number;
  innerBitVectorSize: number;
  earlyLoad: boolean;

  // TODO: get option pass-through

  lengthExpression: WGSLExpressionU32; // TODO: support optional

  // e.g. factorOutSubexpressions
  loadMultipleOptions?: StrictOmit<loadMultipleWGSLOptions<T>, 'loadExpression' | 'loadStatements' | 'storeStatements' | 'type' | 'workgroupSize' | 'grainSize' | 'lengthExpression' | 'outOfRangeValue' | 'inputOrder' | 'inputAccessOrder'>;
} & RakedSizable;
// TODO: options pass-through

export const MAIN_RADIX_SCATTER_DEFAULTS = {
  loadMultipleOptions: {}
} as const;

const mainRadixScatterWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: mainRadixScatterWGSLOptions<T>
): void => {

  const options = optionize3<mainRadixScatterWGSLOptions<T>>()( {}, MAIN_RADIX_SCATTER_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const order = options.order;
  const pass = options.pass;
  const bitsPerPass = options.bitsPerPass;
  const bitsPerInnerPass = options.bitsPerInnerPass;
  const innerBitVectorSize = options.innerBitVectorSize;
  const earlyLoad = options.earlyLoad;
  const lengthExpression = options.lengthExpression;
  const loadMultipleOptions = options.loadMultipleOptions;

  const getBits = ( value: WGSLExpressionT ) => order.getBitsWGSL( value, pass * bitsPerPass, bitsPerPass );

  // TODO: we should have type assertions to make sure these match?
  blueprint.addSlot( 'input', options.input, BufferBindingType.READ_ONLY_STORAGE );
  blueprint.addSlot( 'histogram_offsets', options.histogramOffsets, BufferBindingType.READ_ONLY_STORAGE ); // make sure this is u32?
  blueprint.addSlot( 'output', options.output, BufferBindingType.STORAGE );

  // TODO: generate more of the bindings
  blueprint.add( 'main', `
    
    // TODO: see how we can potentially reuse some memory?
    var<workgroup> bits_scratch: array<${{ 1: 'u32', 2: 'vec2u', 3: 'vec3u', 4: 'vec4u' }[ innerBitVectorSize ]}, ${workgroupSize}>;
    var<workgroup> value_scratch: array<${order.type.valueType( blueprint )}, ${workgroupSize * grainSize}>;
    var<workgroup> local_histogram_offsets: array<u32, ${u32( 1 << bitsPerPass )}>;
    var<workgroup> start_indices: array<u32, ${workgroupSize * grainSize}>;
    
    @compute @workgroup_size(${workgroupSize})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${logStringWGSL( blueprint, 'main_radix_scatter start' )}

      let num_valid_workgroups = ${ceilDivideConstantDivisorWGSL( lengthExpression, workgroupSize * grainSize )};

      ${logValueWGSL( blueprint, {
        value: 'num_valid_workgroups',
        type: U32Type
      } )}

      if ( workgroup_id.x < num_valid_workgroups ) {
        ${loadMultipleWGSL( blueprint, combineOptions<loadMultipleWGSLOptions<T>>( {
          loadExpression: index => `input[ ${index} ]`,
          storeStatements: ( index, value ) => `value_scratch[ ${index} ] = ${value};`,
          type: order.type,
          workgroupSize: workgroupSize,
          grainSize: grainSize,
          lengthExpression: lengthExpression,
          outOfRangeValue: null,
          inputOrder: 'blocked',
          inputAccessOrder: 'striped'
        }, loadMultipleOptions ) )}

        ${logRakedWGSL( blueprint, {
          name: 'initial data',
          type: order.type,
          workgroupSize: workgroupSize,
          grainSize: grainSize,
          lengthExpression: lengthExpression,
          relativeAccessExpression: index => `value_scratch[ ${index} ]`
        } )}

        ${commentWGSL( 'begin load histogram offsets' )}
        ${unrollWGSL( 0, Math.ceil( ( 1 << bitsPerPass ) / workgroupSize ), i => `
          {
            let local_index = ${u32( workgroupSize * i )} + local_id.x;
            if ( local_index < ${u32( 1 << bitsPerPass )} ) {
              local_histogram_offsets[ local_index ] = histogram_offsets[ local_index * num_valid_workgroups + workgroup_id.x ];
            }
          }
        ` )}
        ${commentWGSL( 'end load histogram offsets' )}

        ${logRakedWGSL( blueprint, {
          name: 'scanned histogram',
          type: U32Type,
          workgroupSize: workgroupSize,
          grainSize: grainSize,
          relativeLengthExpression: u32( 1 << bitsPerPass ),
          relativeAccessExpression: index => `histogram_offsets[ ${index} ]`
        } )}

        // Our workgroupBarrier will apply for value_scratch AND local_histogram_offsets
        workgroupBarrier();

        ${lengthExpression ? `
          let reduced_length = ( ${lengthExpression} ) - workgroup_id.x * ${u32( workgroupSize * grainSize )};
        ` : ''}

        ${logValueWGSL( blueprint, {
          value: 'reduced_length',
          type: U32Type
        } )}

        for ( var srs_i = 0u; srs_i < ${u32( bitsPerPass )}; srs_i += ${u32( bitsPerInnerPass )} ) {
          ${logValueWGSL( blueprint, {
            value: 'srs_i',
            type: U32Type
          } )}

          ${nBitCompactSingleSortWGSL( blueprint, {
            order: order,
            workgroupSize: workgroupSize,
            grainSize: grainSize,
            bitsPerInnerPass: bitsPerInnerPass,
            bitVectorSize: innerBitVectorSize,
            bitsScratch: 'bits_scratch',
            valueScratch: 'value_scratch',
            lengthExpression: 'reduced_length', // TODO: lengthExpression ? 'reduced_length' : null
            getBits: value => `( ( ( ${getBits( value )} ) >> srs_i ) & ${u32( ( 1 << bitsPerInnerPass ) - 1 )} )`,
            earlyLoad: earlyLoad
          } )}

          ${logRakedWGSL( blueprint, {
            name: `after b_bit_sort ${bitsPerInnerPass} ${innerBitVectorSize}`,
            type: order.type,
            workgroupSize: workgroupSize,
            grainSize: grainSize,
            lengthExpression: lengthExpression,
            relativeAccessExpression: index => `value_scratch[ ${index} ]`,
            additionalIndex: 'srs_i'
          } )}
        }

        // TODO: we can restructure this so we're not doing all of the reads/bits each time
        ${commentWGSL( 'begin write start_indices' )}
        ${unrollWGSL( 0, grainSize, i => `
          {
            let local_index = ${u32( workgroupSize * i )} + local_id.x;
            ${conditionalIfWGSL( lengthExpression ? 'local_index < reduced_length' : null, `
              var head_value = 0u;

              if ( local_index > 0u && ${getBits( 'value_scratch[ local_index ]' )} != ${getBits( 'value_scratch[ local_index - 1u ]' )} ) {
                head_value = local_index;
              }

              start_indices[ local_index ] = head_value;
            ` )}
          }
        ` )}
        ${commentWGSL( 'end write start_indices' )}

        workgroupBarrier();

        ${scanRakedWGSL( blueprint, {
          scratch: 'start_indices',
          binaryOp: U32Max, // TODO: eeek we need to MAX combine here
          workgroupSize: workgroupSize,
          grainSize: grainSize,
          exclusive: false
        } )}

        workgroupBarrier();

        ${commentWGSL( 'begin write output' )}
        ${unrollWGSL( 0, grainSize, i => `
          {
            let local_index = ${u32( workgroupSize * i )} + local_id.x;
            ${conditionalIfWGSL( lengthExpression ? 'local_index < reduced_length' : null, `
              let local_offset = local_index - start_indices[ local_index ];
              let value = value_scratch[ local_index ];
              let offset = local_histogram_offsets[ ${getBits( 'value' )} ] + local_offset;

              output[ offset ] = value;
            ` )}
          }
        ` )}
        ${commentWGSL( 'end write output' )}

        ${logRakedWGSL( blueprint, {
          name: 'exit(!) data',
          type: order.type,
          workgroupSize: workgroupSize,
          grainSize: grainSize,
          lengthExpression: lengthExpression,
          accessExpression: index => `output[ ${index} ]`
        } )}
      }
    }
  ` );
};

export default mainRadixScatterWGSL;

alpenglow.register( 'mainRadixScatterWGSL', mainRadixScatterWGSL );
