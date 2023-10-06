// Copyright 2023, University of Colorado Boulder

/**
 * We do the following:
 *
 * 1. Binary clip each RasterEdge into two RasterEdgeClips (one for each side of the split)
 * 2. Take these, do a segmented parallel reduction, and
 * 3. During reduction, store associated data to the RasterClippedChunks (precisely when we have reduced all of the
 *    edges for a particular chunk)
 *
 * NOTE: The reduction is also completed in ParallelRasterChunkReduce, so if changing this file, please check there too
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterChunk
#import ./RasterEdge
#import ./RasterEdgeClip
#import ./RasterClippedChunk
#import ./RasterChunkReducePair
#import ./RasterChunkReduceQuad
#import ./RasterStageConfig
#import ./apply_to_clipped_chunk

#option workgroupSize
#option debugReduceBuffers

const veryPositiveNumber = 1.0e10;
const veryNegativeNumber = -1.0e10;

const bounds_none = vec4(
  vec2( veryPositiveNumber ),
  vec2( veryNegativeNumber )
);

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> chunks: array<RasterChunk>;
@group(0) @binding(2)
var<storage, read> edges: array<RasterEdge>;
@group(0) @binding(3)
var<storage, read_write> clipped_chunks: array<RasterClippedChunk>; // mutated
@group(0) @binding(4)
var<storage, read_write> edge_clips: array<RasterEdgeClip>; // written only
@group(0) @binding(5)
var<storage, read_write> chunk_reduces: array<RasterChunkReduceQuad>; // written only
#ifdef debugReduceBuffers
@group(0) @binding(6)
var<storage, read_write> debug_reduces: array<RasterChunkReducePair>;
#endif

var<workgroup> reduces: array<RasterChunkReducePair,${workgroupSize}>;

// Stores the first chunk index for the workgroup. We'll use this to compute the max_first_chunk_index
var<workgroup> first_chunk_index: u32;

// The maximum (local_id.x) that has the same chunkIndex as local_id.x===0.
// We'll need this to compute this so we can deliver the "left" values for future reduction.
var<workgroup> max_first_chunk_index: atomic<u32>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  let edgeIndex = global_id.x;
  let exists = edgeIndex < config.num_input_edges;

  let edge = edges[ edgeIndex ];
  let chunk_index = edge.bits & RasterEdge_bits_chunk_index_mask;
  let edge_first_last = edge.bits & RasterEdge_bits_first_last_mask;
  let chunk = chunks[ chunk_index ];

  // TODO: can we bail early if we're out of range? (exists == false)
  // TODO: we're not doing that because of uniformity, right?

  // We'll workgroupBarrier at least once below, before this is relevant
  if ( exists && local_id.x == 0u ) {
    first_chunk_index = chunk_index;
  }

  // We want to map [offset, offset + num] edgeIndices to [2*offset, 2*offset + num] (min) and [2*offset + num, 2*offset + 2*num] (max)
  // So we add `offset` to min, and `offset + num` to max
  let minEdgeIndex = chunk.edgesOffset + edgeIndex;
  let maxEdgeIndex = chunk.edgesOffset + chunk.numEdges + edgeIndex;
  let minClippedChunkIndex = 2 * chunk_index;
  let maxClippedChunkIndex = 2 * chunk_index + 1;

  /*************************************************************************
   * CLIPPING
   *************************************************************************/

  let xDiff = chunk.maxX - chunk.minX;
  let yDiff = chunk.maxY - chunk.minY;

  let isXSplit = xDiff > yDiff;

  // NOTE: This is set up so that if we have a half-pixel offset e.g. with a bilinear filter, it will work)
  // NOTE: Duplicated in ParallelRasterInitialClip and ParallelRasterInitialChunk
  var split: f32;
  // TODO: see if we should use select here?
  if ( isXSplit ) {
    split = chunk.minX + floor( 0.5 * xDiff );
  }
  else {
    split = chunk.minY + floor( 0.5 * yDiff );
  }

  // NOTE: We're combining both the x-clip and y-clip into concurrent code, so we don't get divergence between
  // invocations/threads.
  // if isXSplit, then x is primary, y is secondary
  // if !isXSplit, then y is primary, x is secondary

  var minPoint0: vec2f;
  var minPoint1: vec2f;
  var minPoint2: vec2f;
  var minPoint3: vec2f;

  var maxPoint0: vec2f;
  var maxPoint1: vec2f;
  var maxPoint2: vec2f;
  var maxPoint3: vec2f;

  var minCount = 0i;
  var maxCount = 0i;
  var minSet = true;
  var maxSet = true;

  let centerSecondary = 0.5 * select( chunk.minX + chunk.maxX, chunk.minY + chunk.maxY, isXSplit );
  let startPoint = vec2( edge.startX, edge.startY );
  let endPoint = vec2( edge.endX, edge.endY );

  // TODO: with fastmath, will these be equivalent?
  let startPrimaryCmp = sign( select( startPoint.y, startPoint.x, isXSplit ) - split );
  let endPrimaryCmp = sign( select( endPoint.y, endPoint.x, isXSplit ) - split );
  let startSecondaryLess = select( startPoint.x, startPoint.y, isXSplit ) < centerSecondary;
  let endSecondaryLess = select( endPoint.x, endPoint.y, isXSplit ) < centerSecondary;

  if ( startPrimaryCmp == endPrimaryCmp ) {
    // both values less than the split
    if ( startPrimaryCmp == -1f ) {
      minPoint0 = startPoint;
      minPoint1 = endPoint;
      minPoint2 = endPoint;
      minPoint3 = endPoint;
      maxSet = false;

      // TODO: is there a way we can do these handling all 3 cases?
      if ( startSecondaryLess != endSecondaryLess ) {
        maxCount += select( -1i, 1i, startSecondaryLess );
      }
    }
    // both values greater than the split
    else if ( startPrimaryCmp == 1f ) {
      maxPoint0 = startPoint;
      maxPoint1 = endPoint;
      maxPoint2 = endPoint;
      maxPoint3 = endPoint;
      minSet = false;

      if ( startSecondaryLess != endSecondaryLess ) {
        minCount += select( -1i, 1i, startSecondaryLess );
      }
    }
    // both values equal to the split
    else if ( startPrimaryCmp == 0f ) {
      // vertical/horizontal line ON our clip point. It is considered "inside" both, so we can just simply push it to both
      minPoint0 = startPoint;
      minPoint1 = endPoint;
      minPoint2 = endPoint;
      minPoint3 = endPoint;

      maxPoint0 = startPoint;
      maxPoint1 = endPoint;
      maxPoint2 = endPoint;
      maxPoint3 = endPoint;
    }
  }
  else {
    // There is a single crossing of our x (possibly on a start or end point)
    let secondaryIntersection = select(
      startPoint.x + ( endPoint.x - startPoint.x ) * ( split - startPoint.y ) / ( endPoint.y - startPoint.y ),
      startPoint.y + ( endPoint.y - startPoint.y ) * ( split - startPoint.x ) / ( endPoint.x - startPoint.x ),
      isXSplit
    );
    let intersection = select(
      vec2( secondaryIntersection, split ),
      vec2( split, secondaryIntersection ),
      isXSplit
    );

    let startLess = startPrimaryCmp == -1f;
    let startGreater = startPrimaryCmp == 1f;
    let endLess = endPrimaryCmp == -1f;
    let endGreater = endPrimaryCmp == 1f;

    let minResultStartPoint = select( intersection, startPoint, startLess );
    let minResultEndPoint = select( intersection, endPoint, endLess );
    let maxResultStartPoint = select( intersection, startPoint, startGreater );
    let maxResultEndPoint = select( intersection, endPoint, endGreater );

    let minSecondary = select( chunk.minX, chunk.minY, isXSplit );
    let maxSecondary = select( chunk.maxX, chunk.maxY, isXSplit );
    let startCornerSecondary = select( maxSecondary, minSecondary, startSecondaryLess );
    let endCornerSecondary = select( maxSecondary, minSecondary, endSecondaryLess );

    minPoint0 = select(
      minResultStartPoint,
      select( vec2( startCornerSecondary, split ), vec2( split, startCornerSecondary ), isXSplit ),
      startGreater
    );
    minPoint1 = minResultStartPoint;
    minPoint2 = minResultEndPoint;
    minPoint3 = select(
      minResultEndPoint,
      select( vec2( endCornerSecondary, split ), vec2( split, endCornerSecondary ), isXSplit ),
      endGreater
    );

    maxPoint0 = select(
      maxResultStartPoint,
      select( vec2( startCornerSecondary, split ), vec2( split, startCornerSecondary ), isXSplit ),
      startLess
    );
    maxPoint1 = maxResultStartPoint;
    maxPoint2 = maxResultEndPoint;
    maxPoint3 = select(
      maxResultEndPoint,
      select( vec2( endCornerSecondary, split ), vec2( split, endCornerSecondary ), isXSplit ),
      endLess
    );
  }

  var minClip = RasterEdgeClip(
    minClippedChunkIndex | edge_first_last,
    minPoint0.x, minPoint0.y,
    minPoint1.x, minPoint1.y,
    minPoint2.x, minPoint2.y,
    minPoint3.x, minPoint3.y
  );
  var maxClip = RasterEdgeClip(
    maxClippedChunkIndex | edge_first_last,
    maxPoint0.x, maxPoint0.y,
    maxPoint1.x, maxPoint1.y,
    maxPoint2.x, maxPoint2.y,
    maxPoint3.x, maxPoint3.y
  );

  // Inlined, because running into pointer issues
  let minArea = 0.5 * (
    ( minClip.p1x + minClip.p0x ) * ( minClip.p1y - minClip.p0y ) +
    ( minClip.p2x + minClip.p1x ) * ( minClip.p2y - minClip.p1y ) +
    ( minClip.p3x + minClip.p2x ) * ( minClip.p3y - minClip.p2y )
  );
  let maxArea = 0.5 * (
    ( maxClip.p1x + maxClip.p0x ) * ( maxClip.p1y - maxClip.p0y ) +
    ( maxClip.p2x + maxClip.p1x ) * ( maxClip.p2y - maxClip.p1y ) +
    ( maxClip.p3x + maxClip.p2x ) * ( maxClip.p3y - maxClip.p2y )
  );

  // minX, minY, maxX, maxY
  var minBounds = select(
    bounds_none,
    vec4(
      min( min( minPoint0, minPoint1 ), min( minPoint2, minPoint3 ) ),
      max( max( minPoint0, minPoint1 ), max( minPoint2, minPoint3 ) )
    ),
    minSet
  );

  if ( minCount != 0i ) {
    if ( isXSplit ) {
      minBounds = vec4(
        minBounds.x,
        min( minBounds.y, chunk.minY ),
        max( minBounds.z, split ),
        max( minBounds.w, chunk.maxY )
      );
    }
    else {
      minBounds = vec4(
        min( minBounds.x, chunk.minX ),
        minBounds.y,
        max( minBounds.z, chunk.maxX ),
        max( minBounds.w, split )
      );
    }
  }

  // minX, minY, maxX, maxY
  var maxBounds = select(
    bounds_none,
    vec4(
      min( min( maxPoint0, maxPoint1 ), min( maxPoint2, maxPoint3 ) ),
      max( max( maxPoint0, maxPoint1 ), max( maxPoint2, maxPoint3 ) )
    ),
    maxSet
  );

  if ( maxCount != 0i ) {
    if ( isXSplit ) {
      maxBounds = vec4(
        min( maxBounds.x, split ),
        min( maxBounds.y, chunk.minY ),
        maxBounds.z,
        max( maxBounds.w, chunk.maxY )
      );
    }
    else {
      maxBounds = vec4(
        min( maxBounds.x, chunk.minX ),
        min( maxBounds.y, split ),
        max( maxBounds.z, chunk.maxX ),
        maxBounds.w
      );
    }
  }

  /*************************************************************************
   * REDUCE AND APPLY
   *************************************************************************/

  var value: RasterChunkReducePair;

  if ( exists ) {
    edge_clips[ minEdgeIndex ] = minClip;
    edge_clips[ maxEdgeIndex ] = maxClip;

    value = RasterChunkReducePair(
      RasterChunkReduceData(
        minClippedChunkIndex | edge_first_last,
        minArea,
        minBounds.x, minBounds.y, minBounds.z, minBounds.w,
        0i, 0i, select( 0i, minCount, isXSplit ), select( minCount, 0i, isXSplit )
      ),
      RasterChunkReduceData(
        maxClippedChunkIndex | edge_first_last,
        maxArea,
        maxBounds.x, maxBounds.y, maxBounds.z, maxBounds.w,
        select( 0i, maxCount, isXSplit ), select( maxCount, 0i, isXSplit ), 0i, 0i
      )
    );

    // If our input is both first/last, we need to handle it before combinations
    // NOTE: min and max will both have the same first/last flags, so we only need to check one
    if ( ( value.min.bits & RasterChunkReduceData_bits_first_last_mask ) == RasterChunkReduceData_bits_first_last_mask ) {
      apply_to_clipped_chunk( value.min );
      apply_to_clipped_chunk( value.max );
    }
  }
  else {
    value = RasterChunkReducePair_out_of_range;
  }

  reduces[ local_id.x ] = value;

#ifdef debugReduceBuffers
  debug_reduces[ global_id.x ] = value;
#endif

  // We need to not double-apply. So we'll only apply when merging into this specific index, since it will
  // (a) be the first combination with the joint "both" result, and (b) it's the simplest to filter for.
  // Note: -5 is different than the "out of range" RasterChunkReduceData value
  // NOTE: we use the bitwise trick to check value.isLastEdge() && !value.isFirstEdge()
  let applicableMinChunkIndex = select(
    0xffffffff, // unavailable clipped chunk index, should not equal anything
    value.min.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask,
    ( value.min.bits & RasterChunkReduceData_bits_first_last_mask ) == RasterChunkReduceData_bits_is_last_edge_mask
  );

  for ( var i = 0u; i < ${u32( Math.log2( workgroupSize ) )}; i++ ) {
    workgroupBarrier();

    let delta = 1u << i;
    if ( local_id.x >= delta ) {
      var otherValue = reduces[ local_id.x - delta ];

      value = RasterChunkReducePair_combine( otherValue, value );

      // NOTE: The similar "max" condition would be identical. It would be
      // |     applicableMaxChunkIndex == otherMaxReduce.chunkIndex && maxReduce.isFirstEdge
      // We effectively only need to check and store one of these, since the min/max indices will be essentially
      // just offset by one
      if (
        ( applicableMinChunkIndex == ( otherValue.min.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask ) ) &&
        ( value.min.bits & RasterChunkReduceData_bits_is_first_edge_mask ) != 0u
      ) {

        // NOTE: We don't need a workgroup barrier here with the two, since (a) we're not executing this for the
        // same indices ever, and (b) we only do it once.
        apply_to_clipped_chunk( value.min );
        apply_to_clipped_chunk( value.max );
      }
    }

    workgroupBarrier();
    reduces[ local_id.x ] = value;
  }

  // Atomically compute the max(localId.x) that has the same chunkIndex as localId.x==0.
  if ( exists && chunk_index == first_chunk_index ) {
    atomicMax( &max_first_chunk_index, local_id.x );
  }
  workgroupBarrier(); // for the atomic

  // Store our reduction result
  if ( exists && local_id.x == 0u ) {
    let last_local_edge_index_in_workgroup = min(
      config.num_input_edges - 1u - workgroup_id.x * ${u32( workgroupSize )},
      ${u32( workgroupSize - 1 )}
    );

    let leftValue = reduces[ atomicLoad( &max_first_chunk_index ) ];
    let rightValue = reduces[ last_local_edge_index_in_workgroup ];

    chunk_reduces[ workgroup_id.x ] = RasterChunkReduceQuad(
      leftValue.min,
      leftValue.max,
      rightValue.min,
      rightValue.max
    );
  }
}
