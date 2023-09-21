// Copyright 2023, University of Colorado Boulder

/**
 * Assorted clipping tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { EdgedFace } from '../imports.js';
import Vector2 from '../../../dot/js/Vector2.js';

QUnit.module( 'ClippableFace' );

QUnit.skip( 'circular edge clip A', assert => {
  const edgedFace = EdgedFace.deserialize( JSON.parse( '{"edges":[{"startPoint":{"x":10.356157588604166,"y":5},"endPoint":{"x":10.666666666666666,"y":5},"containsFakeCorner":false},{"startPoint":{"x":10.666666666666666,"y":5},"endPoint":{"x":10.666666666666666,"y":5.497474167491667},"containsFakeCorner":false},{"startPoint":{"x":5.497474167491667,"y":10.666666666666666},"endPoint":{"x":5,"y":10.666666666666666},"containsFakeCorner":false},{"startPoint":{"x":5,"y":10.666666666666666},"endPoint":{"x":5,"y":10.356157588604166},"containsFakeCorner":false},{"startPoint":{"x":10.412777763525,"y":4.880989576654167},"endPoint":{"x":10.356157588604166,"y":5},"containsFakeCorner":false},{"startPoint":{"x":10.356157588604166,"y":5},"endPoint":{"x":10.412777763525,"y":4.880989576654167},"containsFakeCorner":false},{"startPoint":{"x":10.100520743920832,"y":5.498134292791667},"endPoint":{"x":10.356157588604166,"y":5},"containsFakeCorner":false},{"startPoint":{"x":9.8209414285875,"y":5.9832357012125},"endPoint":{"x":10.100520743920832,"y":5.498134292791667},"containsFakeCorner":false},{"startPoint":{"x":9.5180823628375,"y":6.454154331454167},"endPoint":{"x":9.8209414285875,"y":5.9832357012125},"containsFakeCorner":false},{"startPoint":{"x":9.192661449691666,"y":6.909773908845833},"endPoint":{"x":9.5180823628375,"y":6.454154331454167},"containsFakeCorner":false},{"startPoint":{"x":8.845450073204166,"y":7.3490144238875},"endPoint":{"x":9.192661449691666,"y":6.909773908845833},"containsFakeCorner":false},{"startPoint":{"x":8.477271269966666,"y":7.770834692320833},"endPoint":{"x":8.845450073204166,"y":7.3490144238875},"containsFakeCorner":false},{"startPoint":{"x":8.131727983645833,"y":8.131727983645833},"endPoint":{"x":8.477271269966666,"y":7.770834692320833},"containsFakeCorner":false},{"startPoint":{"x":7.7326737885291665,"y":8.512094694033333},"endPoint":{"x":8.131727983645833,"y":8.131727983645833},"containsFakeCorner":false},{"startPoint":{"x":7.315849173195834,"y":8.872899800799999},"endPoint":{"x":7.7326737885291665,"y":8.512094694033333},"containsFakeCorner":false},{"startPoint":{"x":6.8822120402874996,"y":9.213314139470834},"endPoint":{"x":7.315849173195834,"y":8.872899800799999},"containsFakeCorner":false},{"startPoint":{"x":6.4327589291875,"y":9.5325554055},"endPoint":{"x":6.8822120402874996,"y":9.213314139470834},"containsFakeCorner":false},{"startPoint":{"x":5.968522725925,"y":9.8298899520875},"endPoint":{"x":6.4327589291875,"y":9.5325554055},"containsFakeCorner":false},{"startPoint":{"x":5.490570289466666,"y":10.104634476141666},"endPoint":{"x":5.968522725925,"y":9.8298899520875},"containsFakeCorner":false},{"startPoint":{"x":5,"y":10.356157588604166},"endPoint":{"x":5.490570289466666,"y":10.104634476141666},"containsFakeCorner":false},{"startPoint":{"x":4.880989576654167,"y":10.412777763525},"endPoint":{"x":5,"y":10.356157588604166},"containsFakeCorner":false},{"startPoint":{"x":5,"y":10.356157588604166},"endPoint":{"x":4.880989576654167,"y":10.412777763525},"containsFakeCorner":false},{"startPoint":{"x":10.666666666666666,"y":5.497474167491667},"endPoint":{"x":10.412479677933334,"y":5.964919694058333},"containsFakeCorner":false},{"startPoint":{"x":10.412479677933334,"y":5.964919694058333},"endPoint":{"x":10.137820861462501,"y":6.420637677120833},"containsFakeCorner":false},{"startPoint":{"x":10.137820861462501,"y":6.420637677120833},"endPoint":{"x":9.843230220033334,"y":6.86373213605},"containsFakeCorner":false},{"startPoint":{"x":9.843230220033334,"y":6.86373213605},"endPoint":{"x":9.5292869441,"y":7.293331909145833},"containsFakeCorner":false},{"startPoint":{"x":9.5292869441,"y":7.293331909145833},"endPoint":{"x":9.1966082730625,"y":7.708592366433334},"containsFakeCorner":false},{"startPoint":{"x":9.1966082730625,"y":7.708592366433334},"endPoint":{"x":8.845848281704166,"y":8.108697070249999},"containsFakeCorner":false},{"startPoint":{"x":8.845848281704166,"y":8.108697070249999},"endPoint":{"x":8.4852813742375,"y":8.4852813742375},"containsFakeCorner":false},{"startPoint":{"x":8.4852813742375,"y":8.4852813742375},"endPoint":{"x":8.101920219924999,"y":8.852055622845834},"containsFakeCorner":false},{"startPoint":{"x":8.101920219924999,"y":8.852055622845834},"endPoint":{"x":7.702721548766666,"y":9.201526000733333},"containsFakeCorner":false},{"startPoint":{"x":7.702721548766666,"y":9.201526000733333},"endPoint":{"x":7.288465708566666,"y":9.533009368245834},"containsFakeCorner":false},{"startPoint":{"x":7.288465708566666,"y":9.533009368245834},"endPoint":{"x":6.859962480670834,"y":9.845857746475},"containsFakeCorner":false},{"startPoint":{"x":6.859962480670834,"y":9.845857746475},"endPoint":{"x":6.4180494970125,"y":10.139459583916667},"containsFakeCorner":false},{"startPoint":{"x":6.4180494970125,"y":10.139459583916667},"endPoint":{"x":5.963590602720833,"y":10.4132409519375},"containsFakeCorner":false},{"startPoint":{"x":5.963590602720833,"y":10.4132409519375},"endPoint":{"x":5.497474167491667,"y":10.666666666666666},"containsFakeCorner":false}]}' ) );

  const { insideFace, outsideFace } = edgedFace.getBinaryCircularClip( new Vector2( 10, 10 ), 3.3329999999999997, 0.04908738521234052 );

  assert.ok( Math.abs( insideFace.getArea() + outsideFace.getArea() - edgedFace.getArea() ) < 1e-5, 'area' );
} );