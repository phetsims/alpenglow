// Copyright 2023, University of Colorado Boulder

/**
 * Converts an index from a striped order to a normal (blocked) order.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( ( {
  i, // expr: u32, represents a striped index into data. So 0 is the 1st element, workgroupSIze is the 2nd element, etc.
  workgroupSize, // number
  grainSize, // number
} ) => `
  // TODO: optimizations if workgroupSize or grainSize is 1
  (
    ( ( ${i} ) / ${u32( workgroupSize * grainSize )} ) * ${u32( workgroupSize * grainSize )} +
    ( ( ${i} ) % ${u32( workgroupSize )} ) * ${u32( grainSize )} +
    ( ( ( ${i} ) % ${u32( workgroupSize * grainSize )} ) / ${u32( workgroupSize )} )
  )
`.split( '\n' ).map( s => s.trim() ).join( ' ' ) )}
