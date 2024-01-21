// Copyright 2023-2024, University of Colorado Boulder

/**
 * A template that merges together two sorted arrays into a single sorted array.
 *
 * This version uses block-level loading (for memory coalescing) and circular buffers noted in
 * "Programming Massively Parallel Processors" by Hwu, Kirk and Hajj.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, commentWGSL, getCorankWGSL, mergeSequentialWGSL, u32, unrollWGSL, PipelineBlueprint, WGSLExpressionBool, WGSLExpressionI32, WGSLExpressionT, WGSLExpressionU32, WGSLStatements, WGSLVariableName, WorkgroupSizable } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type mergeWGSLOptions = {
  lengthA: ( pipeline: PipelineBlueprint ) => WGSLExpressionU32;
  lengthB: ( pipeline: PipelineBlueprint ) => WGSLExpressionU32;

  // => {-1, 0, 1} (i32)
  compare: ( blueprint: PipelineBlueprint, indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionI32;

  // used (sometimes) instead of compare if provided
  greaterThan?: ( ( blueprint: PipelineBlueprint, indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionBool ) | null;
  lessThanOrEqual?: ( ( blueprint: PipelineBlueprint, indexA: WGSLExpressionU32, indexB: WGSLExpressionU32 ) => WGSLExpressionBool ) | null;

  // var<workgroup> array<T,sharedMemorySize>
  workgroupA: WGSLVariableName;
  workgroupB: WGSLVariableName;

  loadFromA: ( blueprint: PipelineBlueprint, indexA: WGSLExpressionU32 ) => WGSLExpressionT;
  loadFromB: ( blueprint: PipelineBlueprint, indexB: WGSLExpressionU32 ) => WGSLExpressionT;

  // TODO: we should provide either storeOutput OR setFromA/setFromB. In one case, we set from our shared memory,
  // TODO: but in the other case, it is a global memory (say that we're sorting objects that are much larger?)
  // TODO: would that ALWAYS have worse memory performance? I mean, we're dealing with "global" indices anyway, so
  // TODO: it isn't a huge lift.
  // TODO: For more clarity, if setFromA/setFromB are provided (AND we don't have storeOutput), we'll use those
  // TODO: to directly move things from global memory to global memory. This WILL require more reads, HOWEVER
  // TODO: it will also enable us to have loadFromX methods return a much smaller object used in shared memory.
  // TODO: It is unclear how much of a performance win this would be, so I haven't implemented it yet.
  // TODO:   setFromA, // ( indexOutput, indexA ) => void
  // TODO:   setFromB, // ( indexOutput, indexB ) => void
  storeOutput: ( blueprint: PipelineBlueprint, indexOutput: WGSLExpressionU32, value: WGSLExpressionT ) => WGSLStatements;

  blockOutputSize: number;

  // should be a divisor of blockOutputSize, and ideally a multiple of workgroupSize
  sharedMemorySize: number;

  // controls whether we use atomics to track consumed_a/consumed_b, OR whether we compute another corank
  atomicConsumed?: boolean;
} & WorkgroupSizable;

export const MERGE_DEFAULTS = {
  greaterThan: null,
  lessThanOrEqual: null,
  atomicConsumed: true
} as const;

const mergeWGSL = (
  blueprint: PipelineBlueprint,
  providedOptions: mergeWGSLOptions
): WGSLStatements => {

  const options = optionize3<mergeWGSLOptions>()( {}, MERGE_DEFAULTS, providedOptions );

  const lengthA = options.lengthA;
  const lengthB = options.lengthB;
  const compare = options.compare;
  const greaterThan = options.greaterThan;
  const lessThanOrEqual = options.lessThanOrEqual;
  const workgroupA = options.workgroupA;
  const workgroupB = options.workgroupB;
  const loadFromA = options.loadFromA;
  const loadFromB = options.loadFromB;
  const storeOutput = options.storeOutput;
  const blockOutputSize = options.blockOutputSize;
  const sharedMemorySize = options.sharedMemorySize;
  const atomicConsumed = options.atomicConsumed;
  const workgroupSize = options.workgroupSize;

  assert && assert( Number.isInteger( blockOutputSize / sharedMemorySize ) );
  assert && assert( Number.isInteger( sharedMemorySize / workgroupSize ) );

  blueprint.add( 'merge workgroup handling', `
    ${atomicConsumed ? `
      var<workgroup> consumed_a: atomic<u32>;
      var<workgroup> consumed_b: atomic<u32>;
    ` : ''}
    
    var<workgroup> block_start_a: u32;
    var<workgroup> block_end_a: u32;
  ` );

  // TODO: WorkgroupIndexable and such

  return `
    ${commentWGSL( 'begin merge' )}

    {
      let max_output = ${lengthA( blueprint )} + ${lengthB( blueprint )};
  
      // Determine the output (merged) index range for this entire workgroup (block). We'll likely accomplish this over
      // multiple iterations.
      let block_start_output = min( max_output, workgroup_id.x * ${u32( blockOutputSize )} );
      let block_end_output = min( max_output, block_start_output + ${u32( blockOutputSize )} );
      let block_length = block_end_output - block_start_output;
  
      if ( block_length > 0u ) {
        // Use the first 2 threads to load the coranks for the start/end of the block
        if ( local_id.x < 2u ) {
          let output_index = select( block_start_output, block_end_output, local_id.x == 1u );
          ${getCorankWGSL( blueprint, {
            value: 'block_a',
            outputIndex: 'output_index',
            lengthA: lengthA,
            lengthB: lengthB,
            compare: compare ? ( ( blueprint, indexA, indexB ) => compare( blueprint, loadFromA( blueprint, indexA ), loadFromB( blueprint, indexB ) ) ) : null,
            greaterThan: greaterThan ? ( ( blueprint, indexA, indexB ) => greaterThan( blueprint, loadFromA( blueprint, indexA ), loadFromB( blueprint, indexB ) ) ) : null,
            lessThanOrEqual: lessThanOrEqual ? ( ( blueprint, indexA, indexB ) => lessThanOrEqual( blueprint, loadFromA( blueprint, indexA ), loadFromB( blueprint, indexB ) ) ) : null
          } )}
          if ( local_id.x == 0u ) {
            block_start_a = block_a;
          }
          else {
            block_end_a = block_a;
          }
        }
        workgroupBarrier();
  
        // compute the B corank for the start/end of the block
        let block_start_b = block_start_output - block_start_a;
        let block_end_b = block_end_output - block_end_a;
  
        // We now have the input index ranges [ block_start_a, block_end_a ) and [ block_start_b, block_end_b )
        // that we'll pull from.
  
        // The "processed" indices indicate that we've sorted everything BEFORE this index, and we will make sure every
        // iteration that we've loaded [ processed_index, processed_index + sharedMemorySize ) into shared memory (or
        // at least the portion that is available, and doesn't go past the end of our block_end).
        var processed_index_a = block_start_a;
        var processed_index_b = block_start_b;
  
        // The "loaded" indices indicate that we've loaded the valid portion of [ loaded_index - sharedMemorySize, loaded_index )
        // into our shared memory. When we go to future iterations, we'll only start loading memory there.
        // NOTE: We use circular buffers, so we can just use % sharedMemorySize to get the actual resulting index into
        // the workgroup arrays.
        var loaded_index_a = block_start_a;
        var loaded_index_b = block_start_b;
  
        // "Ceiling" of blockLength / sharedMemorySize (the total number of iterations we'll need to process the entire
        // block).
        let total_iterations = ( block_length + ${u32( sharedMemorySize - 1 )} ) / ${u32( sharedMemorySize )};
        var iteration = 0u;
  
        var oops_count_merge = 0u;
        while ( iteration < total_iterations ) {
          oops_count_merge++;
          if ( oops_count_merge > 0xffu ) {
            break;
          }
  
          // We'll load the next portion of A/B data into shared memory
          // NOTE: two different unrolled loops here, so we (a) go memory accesses more in order, and (b) fewer registers.
          // block_end_a/block_end_b also make sure we won't read past our lengthA/lengthB
  
          // Load "A" values into workgroup memory
          let loading_a_quantity = min( min( block_end_a, processed_index_a + ${u32( sharedMemorySize )} ) - loaded_index_a, ${u32( sharedMemorySize )} );
          ${unrollWGSL( 0, Math.ceil( sharedMemorySize / workgroupSize ), i => `
            {
              // TODO: consider more unique names, so they don't conflict with our loads/etc.
              let relative_index = local_id.x + ${u32( i * workgroupSize )};
              if ( relative_index < loading_a_quantity ) {
                let index = relative_index + loaded_index_a;
                ${workgroupA}[ index % ${u32( sharedMemorySize )} ] = ${loadFromA( blueprint, 'index' )};
              }
            }
          ` )}
          loaded_index_a += loading_a_quantity;
  
          // Load "B" values into workgroup memory
          let loading_b_quantity = min( min( block_end_b, processed_index_b + ${u32( sharedMemorySize )} ) - loaded_index_b, ${u32( sharedMemorySize )} );
          ${unrollWGSL( 0, Math.ceil( sharedMemorySize / workgroupSize ), i => `
            {
              // TODO: consider more unique names, so they don't conflict with our loads/etc.
              let relative_index = local_id.x + ${u32( i * workgroupSize )};
              if ( relative_index < loading_b_quantity ) {
                let index = relative_index + loaded_index_b;
                ${workgroupB}[ index % ${u32( sharedMemorySize )} ] = ${loadFromB( blueprint, 'index' )};
              }
            }
          ` )}
          loaded_index_b += loading_b_quantity;
  
          // We'll also zero out the consumed_a/consumed_b values if applicable (before the workgroupBarrier, so we don't
          // need an extra one.
          ${atomicConsumed ? `
            if ( local_id.x == 0u ) {
              atomicStore( &consumed_a, 0u );
              atomicStore( &consumed_b, 0u );
            }
          ` : ''}
  
          // AT LEAST a barrier for the shared workgroup arrays, but also potentially the atomics.
          workgroupBarrier();
  
          // The base output index for this iteration (all threads). We're going to write into
          // output[ base_iteration_index] to output[ base_iteration_index + sharedMemorySize ]
          let base_iteration_index = block_start_output + iteration * ${u32( sharedMemorySize )};
  
          // The output range for this individual thread [ thread_start_output, thread_end_output )
          let thread_start_output = min( block_end_output, base_iteration_index + local_id.x * ${u32( sharedMemorySize / workgroupSize )} );
          let thread_end_output = min( block_end_output, base_iteration_index + ( local_id.x + 1 ) * ${u32( sharedMemorySize / workgroupSize )} );
          let thread_length = thread_end_output - thread_start_output;
  
          if ( thread_length > 0u ) {
  
            // The length of available A/B data in our current iteration (possibly shorter than sharedMemorySize, since
            // one or both might be near the end). The range of A/B data is:
            // [ processed_index_a, processed_index_a + iteration_length_a )
            let iteration_length_a = loaded_index_a - processed_index_a;
            let iteration_length_b = loaded_index_b - processed_index_b;
  
            // "block"-relative start/end (based on our in-shared-memory section)
            let output_relative_start = thread_start_output - base_iteration_index;
            let output_relative_end = thread_end_output - base_iteration_index;
  
            // Get the corank for the start of our thread's input ranges
            ${getCorankWGSL( blueprint, {
              value: 'thread_relative_start_a',
              outputIndex: 'output_relative_start',
              lengthA: () => 'iteration_length_a',
              lengthB: () => 'iteration_length_b',
              compare: compare ? ( ( blueprint, indexA, indexB ) => compare(
                blueprint,
                `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
                `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
              ) ) : null,
              greaterThan: greaterThan ? ( ( blueprint, indexA, indexB ) => greaterThan(
                blueprint,
                `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
                `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
              ) ) : null,
              lessThanOrEqual: lessThanOrEqual ? ( ( blueprint, indexA, indexB ) => lessThanOrEqual(
                blueprint,
                `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
                `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
              ) ) : null
            } )}
  
            // Get the corank for the end of our thread's input ranges
            ${getCorankWGSL( blueprint, {
              value: 'thread_relative_end_a',
              outputIndex: 'output_relative_end',
              lengthA: () => 'iteration_length_a',
              lengthB: () => 'iteration_length_b',
              compare: compare ? ( ( blueprint, indexA, indexB ) => compare(
                blueprint,
                `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
                `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
              ) ) : null,
              greaterThan: greaterThan ? ( ( blueprint, indexA, indexB ) => greaterThan(
                blueprint,
                `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
                `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
              ) ) : null,
              lessThanOrEqual: lessThanOrEqual ? ( ( blueprint, indexA, indexB ) => lessThanOrEqual(
                blueprint,
                `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
                `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
              ) ) : null
            } )}
  
            // Given the A coranks, compute the B coranks
            let thread_relative_start_b = output_relative_start - thread_relative_start_a;
            let thread_relative_end_b = output_relative_end - thread_relative_end_a;
  
            // How many elements of A and B respectively we'll process in this thread
            let thread_length_a = thread_relative_end_a - thread_relative_start_a;
            let thread_length_b = thread_relative_end_b - thread_relative_start_b;
  
            // Optionally store our counts for A/B length
            ${atomicConsumed ? `
              atomicAdd( &consumed_a, thread_length_a );
              atomicAdd( &consumed_b, thread_length_b );
            ` : ''}
  
            // Actually write things into our output array serially.
            ${mergeSequentialWGSL( blueprint, {
              lengthA: 'thread_length_a',
              lengthB: 'thread_length_b',
              compare: ( blueprint, indexA, indexB ) => compare(
                blueprint,
                // A/B indices are now relative to 0 (for our thread)
                `${workgroupA}[ ( ${indexA} + processed_index_a + thread_relative_start_a ) % ${u32( sharedMemorySize )} ]`,
                `${workgroupB}[ ( ${indexB} + processed_index_b + thread_relative_start_b ) % ${u32( sharedMemorySize )} ]`
              ),
              setFromA: ( blueprint, indexOutput, indexA ) => storeOutput(
                blueprint,
                `( ${indexOutput} + thread_start_output )`,
                `${workgroupA}[ ( ${indexA} + processed_index_a + thread_relative_start_a ) % ${u32( sharedMemorySize )} ]`
              ),
              setFromB: ( blueprint, indexOutput, indexB ) => storeOutput(
                blueprint,
                `( ${indexOutput} + thread_start_output )`,
                `${workgroupB}[ ( ${indexB} + processed_index_b + thread_relative_start_b ) % ${u32( sharedMemorySize )} ]`
              )
            } )}
  
            // If we don't use atomics, we'll need another corank to determine how many elements we consumed.
            ${!atomicConsumed ? `
              let iteration_possible_a_length = loaded_index_a - processed_index_a;
              let iteration_possible_b_length = loaded_index_b - processed_index_b;
  
              // NOTE: The output will be invalid once we're past the end of the block, but we don't care(?)
              ${getCorankWGSL( blueprint, {
                value: 'consumed_a',
                outputIndex: u32( sharedMemorySize ),
                lengthA: () => 'iteration_possible_a_length',
                lengthB: () => 'iteration_possible_b_length',
                compare: compare ? ( ( blueprint, indexA, indexB ) => compare(
                  blueprint,
                  `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
                  `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
                ) ) : null,
                greaterThan: greaterThan ? ( ( blueprint, indexA, indexB ) => greaterThan(
                  blueprint,
                  `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
                  `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
                ) ) : null,
                lessThanOrEqual: lessThanOrEqual ? ( ( blueprint, indexA, indexB ) => lessThanOrEqual(
                  blueprint,
                  `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
                  `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
                ) ) : null
              } )}
  
              let consumed_b = ${u32( sharedMemorySize )} - consumed_a;
  
              processed_index_a += consumed_a;
              processed_index_b += consumed_b;
            ` : ''}
          }
  
          ${atomicConsumed ? `
            workgroupBarrier();
            processed_index_a += atomicLoad( &consumed_a );
            processed_index_b += atomicLoad( &consumed_b );
          ` : ''}
          iteration++;
        }
      }
    }
    ${commentWGSL( 'end merge' )}
  `;
};

export default mergeWGSL;

alpenglow.register( 'mergeWGSL', mergeWGSL );
