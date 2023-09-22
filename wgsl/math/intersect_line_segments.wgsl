// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./IntersectionPoint
#import ./LineSegmentIntersection
#import ./q128
#import ./i32_to_i64
#import ./mul_i64_i64
#import ./subtract_i64_i64
#import ./is_zero_u64
#import ./i64_to_q128
#import ./reduce_q128
#import ./cmp_i64_i64
#import ./equals_cross_mul_q128
#import ./negate_i64
#import ./is_zero_q128
#import ./ratio_test_q128
#import ./add_i64_i64
#import ./whole_i64_to_q128
#import ./ZERO_q128
#import ./ONE_q128

const not_rational = vec4( 0u, 0u, 0u, 0u );
const not_point = IntersectionPoint( not_rational, not_rational, not_rational, not_rational );
const not_intersection = LineSegmentIntersection( 0u, not_point, not_point );

// TODO: isolate constants
// NOTE: Should handle zero-length segments fine (will report no intersections, denominator will be 0)
fn intersect_line_segments( p0: vec2i, p1: vec2i, p2: vec2i, p3: vec2i ) -> LineSegmentIntersection {
  let p0x = i32_to_i64( p0.x );
  let p0y = i32_to_i64( p0.y );
  let p1x = i32_to_i64( p1.x );
  let p1y = i32_to_i64( p1.y );
  let p2x = i32_to_i64( p2.x );
  let p2y = i32_to_i64( p2.y );
  let p3x = i32_to_i64( p3.x );
  let p3y = i32_to_i64( p3.y );

  let d0x = subtract_i64_i64( p1x, p0x );
  let d0y = subtract_i64_i64( p1y, p0y );
  let d1x = subtract_i64_i64( p3x, p2x );
  let d1y = subtract_i64_i64( p3y, p2y );

  let cdx = subtract_i64_i64( p2x, p0x );
  let cdy = subtract_i64_i64( p2y, p0y );

  let denominator = subtract_i64_i64( mul_i64_i64( d0x, d1y ), mul_i64_i64( d0y, d1x ) );

  if ( is_zero_u64( denominator ) ) {
    // such that p0 + t * ( p1 - p0 ) = p2 + ( a * t + b ) * ( p3 - p2 )
    // an equivalency between lines
    var a: q128;
    var b: q128;

    let d1x_zero = is_zero_u64( d1x );
    let d1y_zero = is_zero_u64( d1y );

    // if ( d0s === 0 || d1s === 0 ) {
    //   return NO_OVERLAP;
    // }
    //
    // a = d0s / d1s;
    // b = ( p0s - p2s ) / d1s;

    // TODO: can we reduce the branching here?
    // Find a dimension where our line is not degenerate (e.g. covers multiple values in that dimension)
    // Compute line equivalency there
    if ( d1x_zero && d1y_zero ) {
      // DEGENERATE case for second line, it's a point, bail out
      return not_intersection;
    }
    else if ( d1x_zero ) {
      // if d1x is zero AND our denominator is zero, that means d0x or d1y must be zero. We checked d1y above, so d0x must be zero
      if ( p0.x != p2.x ) {
        // vertical lines, BUT not same x, so no intersection
        return not_intersection;
      }
      a = i64_to_q128( d0y, d1y );
      b = i64_to_q128( negate_i64( cdy ), d1y );
    }
    else if ( d1y_zero ) {
      // if d1y is zero AND our denominator is zero, that means d0y or d1x must be zero. We checked d1x above, so d0y must be zero
      if ( p0.y != p2.y ) {
        // horizontal lines, BUT not same y, so no intersection
        return not_intersection;
      }
      a = i64_to_q128( d0x, d1x );
      b = i64_to_q128( negate_i64( cdx ), d1x );
    }
    else {
      // we have non-axis-aligned second line, use that to compute a,b for each dimension, and we're the same "line"
      // iff those are consistent
      if ( is_zero_u64( d0x ) && is_zero_u64( d0y ) ) {
        // DEGENERATE first line, it's a point, bail out
        return not_intersection;
      }
      let ax = i64_to_q128( d0x, d1x );
      let ay = i64_to_q128( d0y, d1y );
      if ( !equals_cross_mul_q128( ax, ay ) ) {
        return not_intersection;
      }
      let bx = i64_to_q128( negate_i64( cdx ), d1x );
      let by = i64_to_q128( negate_i64( cdy ), d1y );
      if ( !equals_cross_mul_q128( bx, by ) ) {
        return not_intersection;
      }

      // Pick the one with a non-zero a, so it is invertible
      if ( is_zero_q128( ax ) ) {
        a = ay;
        b = by;
      }
      else {
        a = ax;
        b = bx;
      }
    }

    var points: u32 = 0u;
    var results = array<IntersectionPoint, 2u>( not_point, not_point );

    // p0 + t * ( p1 - p0 ) = p2 + ( a * t + b ) * ( p3 - p2 )
    // i.e. line0( t ) = line1( a * t + b )
    // replacements for endpoints:
    // t=0       =>  t0=0,        t1=b
    // t=1       =>  t0=1,        t1=a+b
    // t=-b/a    =>  t0=-b/a,     t1=0
    // t=(1-b)/a =>  t0=(1-b)/a,  t1=1

    // NOTE: cases become identical if b=0, b=1, b=-a, b=1-a, HOWEVER these would not be internal, so they would be
    // excluded, and we can ignore them

    // t0=0, t1=b, p0
    let case1t1 = b;
    if ( ratio_test_q128( case1t1 ) == 2i ) {
      let p = IntersectionPoint( ZERO_q128, reduce_q128( case1t1 ), whole_i64_to_q128( p0x ), whole_i64_to_q128( p0y ) );
      results[ points ] = p;
      points += 1u;
    }

    // t0=1, t1=a+b, p1
    let case2t1 = vec4( add_i64_i64( a.xy, b.xy ), a.zw ); // abuse a,b having same denominator
    if ( ratio_test_q128( case2t1 ) == 2i ) {
      let p = IntersectionPoint( ONE_q128, reduce_q128( case2t1 ), whole_i64_to_q128( p1x ), whole_i64_to_q128( p1y ) );
      results[ points ] = p;
      points += 1u;
    }

    // t0=-b/a, t1=0, p2
    let case3t0 = i64_to_q128( negate_i64( b.xy ), a.xy ); // abuse a,b having same denominator
    if ( ratio_test_q128( case3t0 ) == 2i ) {
      let p = IntersectionPoint( reduce_q128( case3t0 ), ZERO_q128, whole_i64_to_q128( p2x ), whole_i64_to_q128( p2y ) );
      results[ points ] = p;
      points += 1u;
    }

    // t0=(1-b)/a, t1=1, p3
    // ( 1 - b ) / a = ( denom - b_numer ) / denom / ( a_numer / denom ) = ( denom - b_numer ) / a_numer
    let case4t0 = i64_to_q128( subtract_i64_i64( a.zw, b.xy ), a.xy );
    if ( ratio_test_q128( case4t0 ) == 2i ) {
      let p = IntersectionPoint( reduce_q128( case4t0 ), ONE_q128, whole_i64_to_q128( p3x ), whole_i64_to_q128( p3y ) );
      results[ points ] = p;
      points += 1u;
    }

    return LineSegmentIntersection( points, results[ 0 ], results[ 1 ] );
  }
  else {
    let t_numerator = subtract_i64_i64( mul_i64_i64( cdx, d1y ), mul_i64_i64( cdy, d1x ) );
    let u_numerator = subtract_i64_i64( mul_i64_i64( cdx, d0y ), mul_i64_i64( cdy, d0x ) );

    // This will move the sign to the numerator, BUT won't do the reduction (let us first see if there is an intersection)
    let t_raw = i64_to_q128( t_numerator, denominator );
    let u_raw = i64_to_q128( u_numerator, denominator );

    // 2i means totally internal, 1i means on an endpoint, 0i means totally external
    let t_cmp = ratio_test_q128( t_raw );
    let u_cmp = ratio_test_q128( u_raw );

    if ( t_cmp <= 0i || u_cmp <= 0i ) {
      return not_intersection; // outside one or both segments
    }
    else if ( t_cmp == 1i && u_cmp == 1i ) {
      return not_intersection; // on endpoints of both segments (we ignore that, we only want something internal to one)
    }
    else {
      // use parametric segment definition to get the intersection point
      // x0 + t * (x1 - x0)
      // p0x + t_numerator / denominator * d0x
      // ( denominator * p0x + t_numerator * d0x ) / denominator
      let x_numerator = add_i64_i64( mul_i64_i64( denominator, p0x ), mul_i64_i64( t_numerator, d0x ) );
      let y_numerator = add_i64_i64( mul_i64_i64( denominator, p0y ), mul_i64_i64( t_numerator, d0y ) );

      let x_raw = i64_to_q128( x_numerator, denominator );
      let y_raw = i64_to_q128( y_numerator, denominator );

      let x = reduce_q128( x_raw );
      let y = reduce_q128( y_raw );

      let t = reduce_q128( t_raw );
      let u = reduce_q128( u_raw );

      // NOTE: will t/u be exactly 0,1 for endpoints if they are endpoints, no?
      return LineSegmentIntersection( 1u, IntersectionPoint( t, u, x, y ), not_point );
    }
  }
}
