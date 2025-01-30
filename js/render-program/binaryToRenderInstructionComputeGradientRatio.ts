// Copyright 2025, University of Colorado Boulder

/**
 * Reads a RenderInstructionComputeGradientRatio from a binary source.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import { RenderInstructionComputeGradientRatio } from './RenderInstructionComputeGradientRatio.js';
import { GRADIENT_BEFORE_RATIO_COUNT_BITS } from './GRADIENT_BEFORE_RATIO_COUNT_BITS.js';
import { RenderLinearGradientLogic } from './RenderLinearGradientLogic.js';
import { RenderRadialGradientLogic } from './RenderRadialGradientLogic.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';

export const binaryToRenderInstructionComputeGradientRatio = (
  encoder: ByteEncoder,
  offset: number,
  getLocation: ( offset: number ) => RenderInstructionLocation
): RenderInstructionComputeGradientRatio => {

  const first = encoder.fullU32Array[ offset ];
  const isLinear = ( first & 0xff ) === RenderInstruction.ComputeLinearGradientRatioCode;
  const accuracy = ( first >> 8 ) & 0x7;
  const extend = ( first >> 11 ) & 0x3;
  const ratioCount = first >> GRADIENT_BEFORE_RATIO_COUNT_BITS;
  const transform = Matrix3.rowMajor(
    encoder.fullF32Array[ offset + 1 ],
    encoder.fullF32Array[ offset + 2 ],
    encoder.fullF32Array[ offset + 3 ],
    encoder.fullF32Array[ offset + 4 ],
    encoder.fullF32Array[ offset + 5 ],
    encoder.fullF32Array[ offset + 6 ],
    0, 0, 1
  );
  const blendOffset = offset + ( isLinear ? 11 : 9 );
  const ratioOffset = blendOffset + 1;

  const ratios: number[] = [];
  const stopLocations: RenderInstructionLocation[] = [];
  const blendLocation = getLocation( encoder.fullU32Array[ blendOffset ] );

  for ( let i = 0; i < ratioCount; i++ ) {
    ratios.push( encoder.fullF32Array[ ratioOffset + 2 * i ] );
    stopLocations.push( getLocation( encoder.fullU32Array[ ratioOffset + 2 * i + 1 ] ) );
  }

  if ( isLinear ) {
    const start = new Vector2(
      encoder.fullF32Array[ offset + 7 ],
      encoder.fullF32Array[ offset + 8 ]
    );
    const gradDelta = new Vector2(
      encoder.fullF32Array[ offset + 9 ],
      encoder.fullF32Array[ offset + 10 ]
    );

    return new RenderInstructionComputeGradientRatio(
      new RenderLinearGradientLogic(
        transform, // inverseTransform
        start,
        gradDelta,
        ratios,
        extend,
        accuracy
      ),
      stopLocations,
      blendLocation
    );
  }
  else {
    const kind = ( first >> 13 ) & 0x3;
    const isSwapped = ( first & ( 1 << 15 ) ) !== 0;
    const focalX = encoder.fullF32Array[ offset + 7 ];
    const radius = encoder.fullF32Array[ offset + 8 ];

    return new RenderInstructionComputeGradientRatio(
      new RenderRadialGradientLogic(
        transform, // conicTransform
        focalX,
        radius,
        kind,
        isSwapped,
        ratios,
        extend,
        accuracy
      ),
      stopLocations,
      blendLocation
    );
  }
};