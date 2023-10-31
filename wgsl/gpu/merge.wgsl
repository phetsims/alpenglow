// Copyright 2023, University of Colorado Boulder

/**
 * A template that merges together two sorted arrays into a single sorted array.
 *
 * This version uses block-level loading (for memory coalescing) and circular buffers noted in
 * "Programming Massively Parallel Processors".
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./get_corank
#import ./merge_sequential
#import ./unroll

#bindings

var<workgroup> block_start_a: u32;
var<workgroup> block_end_a: u32;
// TODO: don't share these, we can compute easily?
var<workgroup> block_start_b: u32;
var<workgroup> block_end_b: u32;

${template( ( {
  workgroupA, // var<workgroup> array<T,sharedMemorySize>
  workgroupB, // var<workgroup> array<T,sharedMemorySize>
  loadFromA, // ( indexA ) => T
  loadFromB, // ( indexB ) => T,
  // TODO: we should provide either storeOutput OR setFromA/setFromB. In one case, we set from our shared memory,
  // TODO: but in the other case, it is a global memory (say that we're sorting objects that are much larger?)
//  setFromA, // ( indexOutput, indexA ) => void
//  setFromB, // ( indexOutput, indexB ) => void
  storeOutput, // ( indexOutput, value ) => void
  lengthA, // expression: u32
  lengthB, // expression: u32
  workgroupSize, // number
  blockOutputSize, // number
  sharedMemorySize, // number - should be a divisor of blockOutputSize, and ideally a multiple of workgroupSize
  compare, // ( valueA, valueB ) => {-1, 0, 1} --- takes expressions (not just names)
  greaterThan, // ( valueA, valueB ) => bool --- used instead of compare if provided
  lessThanOrEqual // ( valueA, valueB ) => bool --- used instead of compare if provided
} ) => `
  ${( assert && assert( Number.isInteger( blockOutputSize / sharedMemorySize ) ) ), ''}
  ${( assert && assert( Number.isInteger( sharedMemorySize / workgroupSize ) ) ), ''}
  {
    // TODO: note linear workgroup size and ordering?

    let max_output = ${lengthA} + ${lengthB};
    let block_start_output = min( max_output, workgroup_id.x * ${u32( blockOutputSize )} );
    let block_end_output = min( max_output, block_start_output + ${u32( blockOutputSize )} );
    let block_length = block_end_output - block_start_output;

    if ( block_length > 0u ) {
      // Use the first 2 threads to load the coranks for the start/end of the block
      if ( local_id.x < 2u ) {
        let output_index = select( block_start_output, block_end_output, local_id.x == 1u );
        ${get_corank( {
          value: `block_a`,
          outputIndex: `output_index`,
          lengthA: lengthA,
          lengthB: lengthB,
          compare: compare ? ( ( indexA, indexB ) => compare( loadFromA( indexA ), loadFromB( indexB ) ) ) : undefined,
          greaterThan: greaterThan ? ( ( indexA, indexB ) => greaterThan( loadFromA( indexA ), loadFromB( indexB ) ) ) : undefined,
          lessThanOrEqual: lessThanOrEqual ? ( ( indexA, indexB ) => lessThanOrEqual( loadFromA( indexA ), loadFromB( indexB ) ) ) : undefined
        } )}
        if ( local_id.x == 0u ) {
          block_start_a = block_a;
          block_start_b = output_index - block_a;
        }
        else {
          block_end_a = block_a;
          block_end_b = output_index - block_a;
        }
      }
      workgroupBarrier();

      var processed_index_a = block_start_a;
      var processed_index_b = block_start_b;
      var loaded_index_a = block_start_a;
      var loaded_index_b = block_start_b;

      // "Ceiling" of blockLength / sharedMemorySize
      let total_iterations = ( block_length + ${u32( sharedMemorySize - 1)} ) / ${u32( sharedMemorySize )};
      var iteration = 0u;

      var oops_count_merge = 0u;
      while ( iteration < total_iterations ) {
        oops_count_merge++;
        if ( oops_count_merge > 0xffu ) {
          break;
        }

        // NOTE: two different unrolled loops here, so we (a) go memory accesses more in order, and (b) fewer registers

        // Load "A" values into workgroup memory
        let loading_a_quantity = min( block_end_a - loaded_index_a, ${u32( sharedMemorySize )} );
        ${unroll( 0, Math.ceil( sharedMemorySize / workgroupSize ), i => `
          {
            // TODO: consider more unique names, so they don't conflict with our loads/etc.
            let relative_index = local_id.x + ${u32( i * workgroupSize )};
            if ( relative_index < loading_a_quantity ) {
              let index = relative_index + loaded_index_a;
              ${workgroupA}[ index % ${u32( sharedMemorySize )} ] = ${loadFromA( `index` )};
            }
          }
        ` )}
        loaded_index_a += loading_a_quantity;

        // Load "B" values into workgroup memory
        let loading_b_quantity = min( block_end_b - loaded_index_b, ${u32( sharedMemorySize )} );
        ${unroll( 0, Math.ceil( sharedMemorySize / workgroupSize ), i => `
          {
            // TODO: consider more unique names, so they don't conflict with our loads/etc.
            let relative_index = local_id.x + ${u32( i * workgroupSize )};
            if ( relative_index < loading_b_quantity ) {
              let index = relative_index + loaded_index_b;
              ${workgroupB}[ index % ${u32( sharedMemorySize )} ] = ${loadFromB( `index` )};
            }
          }
        ` )}
        loaded_index_b += loading_b_quantity;

        workgroupBarrier();

        // The base output index for this iteration (all threads). We're going to write into
        // output[ base_iteration_index] to output[ base_iteration_index + sharedMemorySize ]
        let base_iteration_index = block_start_output + iteration * ${u32( sharedMemorySize )};

        // The output range for this individual thread
        let thread_start_output = min( block_end_output, base_iteration_index + local_id.x * ${u32( sharedMemorySize / workgroupSize )} );
        let thread_end_output = min( block_end_output, base_iteration_index + ( local_id.x + 1 ) * ${u32( sharedMemorySize / workgroupSize )} );
        let thread_length = thread_end_output - thread_start_output;

        // TODO: eek, we've mixed up our constants and stuff, double check everything
        if ( thread_length > 0u ) {

          // The length of available A/B data in our current iteration (possibly shorter than sharedMemorySize, since
          // one or both might be near the end). The range of A/B data is:
          // [ processed_index_a, processed_index_a + iteration_length_a )
          let iteration_length_a = loaded_index_a - processed_index_a;
          let iteration_length_b = loaded_index_b - processed_index_b;

          // "block" relative start/end
          let output_relative_start = thread_start_output - base_iteration_index;
          let output_relative_end = thread_end_output - base_iteration_index;

          ${get_corank( {
            value: `thread_relative_start_a`,
            outputIndex: `output_relative_start`,
            lengthA: `iteration_length_a`,
            lengthB: `iteration_length_b`,
            compare: compare ? ( ( indexA, indexB ) => compare(
              // TODO: Figure out what goes here
              `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
              `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
            ) ) : undefined,
            greaterThan: greaterThan ? ( ( indexA, indexB ) => greaterThan(
              `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
              `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
            ) ) : undefined,
            lessThanOrEqual: lessThanOrEqual ? ( ( indexA, indexB ) => lessThanOrEqual(
              `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
              `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
            ) ) : undefined
          } )}

          ${get_corank( {
            value: `thread_relative_end_a`,
            outputIndex: `output_relative_end`,
            lengthA: `iteration_length_a`,
            lengthB: `iteration_length_b`,
            compare: compare ? ( ( indexA, indexB ) => compare(
              `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
              `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
            ) ) : undefined,
            greaterThan: greaterThan ? ( ( indexA, indexB ) => greaterThan(
              `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
              `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
            ) ) : undefined,
            lessThanOrEqual: lessThanOrEqual ? ( ( indexA, indexB ) => lessThanOrEqual(
              `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
              `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
            ) ) : undefined
          } )}

          let thread_relative_start_b = output_relative_start - thread_relative_start_a;
          let thread_relative_end_b = output_relative_end - thread_relative_end_a;

          let thread_length_a = thread_relative_end_a - thread_relative_start_a;
          let thread_length_b = thread_relative_end_b - thread_relative_start_b;

          ${merge_sequential( {
            lengthA: `thread_length_a`,
            lengthB: `thread_length_b`,
            compare: ( indexA, indexB ) => compare(
              // A/B indices are now relative to 0 (for our thread)
              `${workgroupA}[ ( ${indexA} + processed_index_a + thread_relative_start_a ) % ${u32( sharedMemorySize )} ]`,
              `${workgroupB}[ ( ${indexB} + processed_index_b + thread_relative_start_b ) % ${u32( sharedMemorySize )} ]`
            ),
            setFromA: ( indexOutput, indexA ) => storeOutput(
              `( ${indexOutput} + thread_start_output )`,
              `${workgroupA}[ ( ${indexA} + processed_index_a + thread_relative_start_a ) % ${u32( sharedMemorySize )} ]`
            ),
            setFromB: ( indexOutput, indexB ) => storeOutput(
              `( ${indexOutput} + thread_start_output )`,
              `${workgroupB}[ ( ${indexB} + processed_index_b + thread_relative_start_b ) % ${u32( sharedMemorySize )} ]`
            )
          } )}
        }

        // NOTE: The output will be invalid once we're past the end of the block, but we don't care(?)
        ${get_corank( {
          value: `consumed_a`,
          outputIndex: u32( sharedMemorySize ),
          lengthA: u32( sharedMemorySize ),
          lengthB: u32( sharedMemorySize ),
          compare: compare ? ( ( indexA, indexB ) => compare(
            `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
            `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
          ) ) : undefined,
          greaterThan: greaterThan ? ( ( indexA, indexB ) => greaterThan(
            `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
            `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
          ) ) : undefined,
          lessThanOrEqual: lessThanOrEqual ? ( ( indexA, indexB ) => lessThanOrEqual(
            `${workgroupA}[ ( ${indexA} + processed_index_a ) % ${u32( sharedMemorySize )} ]`,
            `${workgroupB}[ ( ${indexB} + processed_index_b ) % ${u32( sharedMemorySize )} ]`
          ) ) : undefined
        } )}
        let consumed_b = ${u32( sharedMemorySize )} - consumed_a;

        processed_index_a += consumed_a;
        processed_index_b += consumed_b;
        iteration++;
      }
    }
  }
` )}
