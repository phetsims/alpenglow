// Copyright 2025, University of Colorado Boulder

/**
 * Extracts a single instruction from the binary format at a given (32bit dword) offset.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderInstruction, RenderInstructionExit, RenderInstructionLocation, RenderInstructionMultiplyScalar, RenderInstructionPush, RenderInstructionReturn } from './RenderInstruction.js';
import { RenderInstructionPremultiply } from './RenderPremultiply.js';
import { RenderInstructionUnpremultiply } from './RenderUnpremultiply.js';
import { RenderInstructionOpaqueJump, RenderInstructionStackBlend } from './RenderStack.js';
import { RenderInstructionLinearBlend } from './RenderLinearBlend.js';
import { RenderInstructionLinearDisplayP3ToLinearSRGB } from './RenderLinearDisplayP3ToLinearSRGB.js';
import { RenderInstructionLinearSRGBToLinearDisplayP3 } from './RenderLinearSRGBToLinearDisplayP3.js';
import { RenderInstructionLinearSRGBToOklab } from './RenderLinearSRGBToOklab.js';
import { RenderInstructionLinearSRGBToSRGB } from './RenderLinearSRGBToSRGB.js';
import { RenderInstructionOklabToLinearSRGB } from './RenderOklabToLinearSRGB.js';
import { RenderInstructionSRGBToLinearSRGB } from './RenderSRGBToLinearSRGB.js';
import { RenderInstructionNormalize } from './RenderNormalize.js';
import { RenderInstructionBlendCompose } from './RenderBlendCompose.js';
import { RenderInstructionNormalDebug } from './RenderNormalDebug.js';
import { RenderInstructionPhong } from './RenderPhong.js';
import { RenderInstructionBarycentricBlend } from './RenderBarycentricBlend.js';
import { RenderInstructionBarycentricPerspectiveBlend } from './RenderBarycentricPerspectiveBlend.js';
import { RenderInstructionFilter } from './RenderFilter.js';
import { alpenglow } from '../alpenglow.js';
import { binaryToRenderInstructionComputeBlendRatio } from './binaryToRenderInstructionComputeBlendRatio.js';
import { binaryToRenderInstructionComputeGradientRatio } from './binaryToRenderInstructionComputeGradientRatio.js';

export const binaryToRenderInstruction = (
  encoder: ByteEncoder,
  offset: number,
  getLocation: ( offset: number ) => RenderInstructionLocation
): RenderInstruction => {
  const code = encoder.fullU32Array[ offset ] & 0xff;

  switch( code ) {
    case RenderInstruction.ReturnCode:
      return RenderInstructionReturn.INSTANCE;
    case RenderInstruction.PremultiplyCode:
      return RenderInstructionPremultiply.INSTANCE;
    case RenderInstruction.UnpremultiplyCode:
      return RenderInstructionUnpremultiply.INSTANCE;
    case RenderInstruction.StackBlendCode:
      return RenderInstructionStackBlend.INSTANCE;
    case RenderInstruction.LinearBlendCode:
      return RenderInstructionLinearBlend.INSTANCE;
    case RenderInstruction.LinearDisplayP3ToLinearSRGBCode:
      return RenderInstructionLinearDisplayP3ToLinearSRGB.INSTANCE;
    case RenderInstruction.LinearSRGBToLinearDisplayP3Code:
      return RenderInstructionLinearSRGBToLinearDisplayP3.INSTANCE;
    case RenderInstruction.LinearSRGBToOklabCode:
      return RenderInstructionLinearSRGBToOklab.INSTANCE;
    case RenderInstruction.LinearSRGBToSRGBCode:
      return RenderInstructionLinearSRGBToSRGB.INSTANCE;
    case RenderInstruction.OklabToLinearSRGBCode:
      return RenderInstructionOklabToLinearSRGB.INSTANCE;
    case RenderInstruction.SRGBToLinearSRGBCode:
      return RenderInstructionSRGBToLinearSRGB.INSTANCE;
    case RenderInstruction.NormalizeCode:
      return RenderInstructionNormalize.INSTANCE;
    case RenderInstruction.ExitCode:
      return RenderInstructionExit.INSTANCE;
    case RenderInstruction.BlendComposeCode:
      return RenderInstructionBlendCompose.fromBinary( encoder, offset, getLocation );
    case RenderInstruction.OpaqueJumpCode:
      return RenderInstructionOpaqueJump.fromBinary( encoder, offset, getLocation );
    case RenderInstruction.NormalDebugCode:
      return RenderInstructionNormalDebug.INSTANCE;
    case RenderInstruction.MultiplyScalarCode:
      return RenderInstructionMultiplyScalar.fromBinary( encoder, offset, getLocation );
    case RenderInstruction.PhongCode:
      return RenderInstructionPhong.fromBinary( encoder, offset, getLocation );
    case RenderInstruction.PushCode:
      return RenderInstructionPush.fromBinary( encoder, offset, getLocation );
    case RenderInstruction.ComputeLinearBlendRatioCode:
    case RenderInstruction.ComputeRadialBlendRatioCode:
      return binaryToRenderInstructionComputeBlendRatio( encoder, offset, getLocation );
    case RenderInstruction.BarycentricBlendCode:
      return RenderInstructionBarycentricBlend.fromBinary( encoder, offset, getLocation );
    case RenderInstruction.BarycentricPerspectiveBlendCode:
      return RenderInstructionBarycentricPerspectiveBlend.fromBinary( encoder, offset, getLocation );
    case RenderInstruction.FilterCode:
      return RenderInstructionFilter.fromBinary( encoder, offset, getLocation );
    case RenderInstruction.ComputeLinearGradientRatioCode:
    case RenderInstruction.ComputeRadialGradientRatioCode:
      return binaryToRenderInstructionComputeGradientRatio( encoder, offset, getLocation );
    default:
      throw new Error( `Unknown/unimplemented instruction code: ${code}` );
  }
};
alpenglow.register( 'binaryToRenderInstruction', binaryToRenderInstruction );