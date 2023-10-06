// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterClippedChunk
#import ./RasterSplitReduceData

// TODO: better namespacing for less verbosity
const RasterClippedChunk_bits_complete_output_split_mask =
  RasterClippedChunk_bits_is_complete_mask |
  RasterClippedChunk_bits_is_full_area_mask |
  RasterClippedChunk_bits_is_constant_mask;

const RasterClippedChunk_bits_complete_output_split_value =
  RasterClippedChunk_bits_is_complete_mask |
  RasterClippedChunk_bits_is_full_area_mask;

const RasterClippedChunk_bits_exporting_complete_edges_mask =
  RasterClippedChunk_bits_is_complete_mask |
  RasterClippedChunk_bits_is_full_area_mask |
  RasterClippedChunk_bits_needs_face_mask;

const RasterClippedChunk_bits_exporting_complete_edges_value =
  RasterClippedChunk_bits_is_complete_mask |
  RasterClippedChunk_bits_needs_face_mask;

// TODO: can we inline things like this? ALTERNATIVE: We use macros for inline functions
// TODO: or, can we compute everything needed to inline WGSL functions?
// TODO: we have the templating engine, could just... use that?
fn RasterClippedChunk_needs_complete_output_split( clipped_chunk: RasterClippedChunk ) -> bool {
  // this.isComplete && this.isFullArea && !this.isConstant;
  return ( clipped_chunk.bits & RasterClippedChunk_bits_complete_output_split_mask ) == RasterClippedChunk_bits_complete_output_split_value;
}

fn RasterClippedChunk_get_output_split_count( clipped_chunk: RasterClippedChunk ) -> u32 {
  // Rounding as a sanity check?
  return u32( round( ( clipped_chunk.maxX - clipped_chunk.minX ) * ( clipped_chunk.maxY - clipped_chunk.minY ) ) );
}

fn RasterClippedChunk_get_data( clipped_chunk: RasterClippedChunk ) -> RasterSplitReduceData {
  let is_reducible = ( clipped_chunk.bits & RasterClippedChunk_bits_is_reducible_mask ) != 0u;
  let is_complete = ( clipped_chunk.bits & RasterClippedChunk_bits_is_complete_mask ) != 0u;

  return RasterSplitReduceData(
    select( 0u, 1u, is_reducible ),
    select(
      0u,
      select(
        1u,
        RasterClippedChunk_get_output_split_count( clipped_chunk ),
        RasterClippedChunk_needs_complete_output_split( clipped_chunk )
      ),
      is_complete
    )
  );
}

fn RasterClippedChunk_is_exporting_complete_edges( clipped_chunk: RasterClippedChunk ) -> bool {
  // return clipped_chunk.isComplete && !clipped_chunk.isFullArea && clipped_chunk.needsFace;
  return ( clipped_chunk.bits & RasterClippedChunk_bits_exporting_complete_edges_mask ) == RasterClippedChunk_bits_exporting_complete_edges_value;
}
