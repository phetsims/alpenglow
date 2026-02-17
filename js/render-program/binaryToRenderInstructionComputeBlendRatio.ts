// Copyright 2025, University of Colorado Boulder

/**
 * Reads a RenderInstructionComputeBlendRatio from a binary source.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';
import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import { RenderInstructionComputeBlendRatio } from './RenderInstructionComputeBlendRatio.js';
import { RenderLinearBlendLogic } from './RenderLinearBlendLogic.js';
import { RenderRadialBlendLogic } from './RenderRadialBlendLogic.js';

export const binaryToRenderInstructionComputeBlendRatio = (
  encoder: ByteEncoder,
  offset: number,
  getLocation: ( offset: number ) => RenderInstructionLocation
): RenderInstructionComputeBlendRatio => {
  const zeroLocation = getLocation( encoder.fullU32Array[ offset + 1 ] );
  const oneLocation = getLocation( encoder.fullU32Array[ offset + 2 ] );
  const blendLocation = getLocation( encoder.fullU32Array[ offset + 3 ] );

  const first = encoder.fullU32Array[ offset ];
  const accuracy = ( first >> 8 ) & 0xff; // TODO: precision excessive?

  if ( ( first & 0xff ) === RenderInstruction.ComputeLinearBlendRatioCode ) {
    const scaledNormal = new Vector2(
      encoder.fullF32Array[ offset + 4 ],
      encoder.fullF32Array[ offset + 5 ]
    );
    const off = encoder.fullF32Array[ offset + 6 ];

    return new RenderInstructionComputeBlendRatio(
      new RenderLinearBlendLogic( scaledNormal, off, accuracy ),
      zeroLocation,
      oneLocation,
      blendLocation
    );
  }
  else {
    const inverseTransform = Matrix3.rowMajor(
      encoder.fullF32Array[ offset + 4 ],
      encoder.fullF32Array[ offset + 5 ],
      encoder.fullF32Array[ offset + 6 ],
      encoder.fullF32Array[ offset + 7 ],
      encoder.fullF32Array[ offset + 8 ],
      encoder.fullF32Array[ offset + 9 ],
      0, 0, 1
    );
    const radius0 = encoder.fullF32Array[ offset + 10 ];
    const radius1 = encoder.fullF32Array[ offset + 11 ];

    return new RenderInstructionComputeBlendRatio(
      new RenderRadialBlendLogic( inverseTransform, radius0, radius1, accuracy ),
      zeroLocation,
      oneLocation,
      blendLocation
    );
  }
};