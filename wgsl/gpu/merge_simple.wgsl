// Copyright 2023, University of Colorado Boulder

/**
 * A template that merges together two sorted arrays into a single sorted array.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./get_corank
#import ./merge_sequential

${template( ( {
  lengthA, // expression: u32
  lengthB, // expression: u32
  setFromA, // ( indexOutput, indexA ) => void
  setFromB, // ( indexOutput, indexB ) => void
  grainSize, // number
  compare, // ( indexA, indexB ) => {-1, 0, 1} --- takes expressions (not just names)
  greaterThan, // ( indexA, indexB ) => bool --- used instead of compare if provided
  lessThanOrEqual // ( indexA, indexB ) => bool --- used instead of compare if provided
} ) => `
  {
    // TODO: don't assume a specific linear workgroup size? -- use local_invocation_index?
    let max_output = ${lengthA} + ${lengthB};
    let start_output = min( max_output, global_id.x * ${u32( grainSize )} );
    let end_output = min( max_output, start_output + ${u32( grainSize )} );

    if ( start_output != end_output ) {
      ${get_corank( {
        value: `start_a`,
        outputIndex: `start_output`,
        lengthA: lengthA,
        lengthB: lengthB,
        compare: compare,
        greaterThan: greaterThan,
        lessThanOrEqual: lessThanOrEqual
      } )}
      ${get_corank( {
        value: `end_a`,
        outputIndex: `end_output`,
        lengthA: lengthA,
        lengthB: lengthB,
        compare: compare,
        greaterThan: greaterThan,
        lessThanOrEqual: lessThanOrEqual
      } )}


      let start_b = start_output - start_a;
      let end_b = end_output - end_a;

      let span_a = end_a - start_a;
      let span_b = end_b - start_b;

      ${merge_sequential( {
        lengthA: `span_a`,
        lengthB: `span_b`,
        compare: ( indexA, indexB ) => compare( `start_a + ${indexA}`, `start_b + ${indexB}` ),
        setFromA: ( indexOutput, indexA ) => setFromA( `start_output + ${indexOutput}`, `start_a + ${indexA}` ),
        setFromB: ( indexOutput, indexB ) => setFromB( `start_output + ${indexOutput}`, `start_b + ${indexB}` )
      } )}
    }
  }
` )}
