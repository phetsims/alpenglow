// Copyright 2023, University of Colorado Boulder

/**
 * Ordered imports that should be loaded IN THIS ORDER, so we can get around circular dependencies for type checking.
 * Recommended as an approach in
 * https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de
 *
 * Internally in Alpenglow, we'll import from this file instead of directly importing, so we'll be able to control the
 * module load order to prevent errors.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export { default as alpenglow } from './alpenglow.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_u64 } from '../wgsl/math/u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_i64 } from '../wgsl/math/i64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_q128 } from '../wgsl/math/q128.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_ZERO_u64 } from '../wgsl/math/ZERO_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_ONE_u64 } from '../wgsl/math/ONE_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_ZERO_q128 } from '../wgsl/math/ZERO_q128.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_ONE_q128 } from '../wgsl/math/ONE_q128.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_u32_to_u64 } from '../wgsl/math/u32_to_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_i32_to_i64 } from '../wgsl/math/i32_to_i64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_add_u32_u32_to_u64 } from '../wgsl/math/add_u32_u32_to_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_mul_u32_u32_to_u64 } from '../wgsl/math/mul_u32_u32_to_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_add_u64_u64 } from '../wgsl/math/add_u64_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_add_i64_i64 } from '../wgsl/math/add_i64_i64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_negate_i64 } from '../wgsl/math/negate_i64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_is_zero_u64 } from '../wgsl/math/is_zero_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_is_negative_i64 } from '../wgsl/math/is_negative_i64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_abs_i64 } from '../wgsl/math/abs_i64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_left_shift_u64 } from '../wgsl/math/left_shift_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_right_shift_u64 } from '../wgsl/math/right_shift_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_first_leading_bit_u64 } from '../wgsl/math/first_leading_bit_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_first_trailing_bit_u64 } from '../wgsl/math/first_trailing_bit_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_subtract_i64_i64 } from '../wgsl/math/subtract_i64_i64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_cmp_u64_u64 } from '../wgsl/math/cmp_u64_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_cmp_i64_i64 } from '../wgsl/math/cmp_i64_i64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_mul_u64_u64 } from '../wgsl/math/mul_u64_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_mul_i64_i64 } from '../wgsl/math/mul_i64_i64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_div_u64_u64 } from '../wgsl/math/div_u64_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_gcd_u64_u64 } from '../wgsl/math/gcd_u64_u64.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_i64_to_q128 } from '../wgsl/math/i64_to_q128.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_whole_i64_to_q128 } from '../wgsl/math/whole_i64_to_q128.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_equals_cross_mul_q128 } from '../wgsl/math/equals_cross_mul_q128.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_is_zero_q128 } from '../wgsl/math/is_zero_q128.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_ratio_test_q128 } from '../wgsl/math/ratio_test_q128.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_reduce_q128 } from '../wgsl/math/reduce_q128.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_IntersectionPoint } from '../wgsl/math/IntersectionPoint.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_LineSegmentIntersection } from '../wgsl/math/LineSegmentIntersection.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_intersect_line_segments } from '../wgsl/math/intersect_line_segments.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_cbrt } from '../wgsl/math/cbrt.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_shoelace } from '../wgsl/integrals/shoelace.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_LinearEdge } from '../wgsl/cag/LinearEdge.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_sRGB_to_linear_sRGB } from '../wgsl/color/sRGB_to_linear_sRGB.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_linear_sRGB_to_sRGB } from '../wgsl/color/linear_sRGB_to_sRGB.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_premultiply } from '../wgsl/color/premultiply.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_unpremultiply } from '../wgsl/color/unpremultiply.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_linear_sRGB_to_oklab } from '../wgsl/color/linear_sRGB_to_oklab.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_oklab_to_linear_sRGB } from '../wgsl/color/oklab_to_linear_sRGB.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_linear_displayP3_to_linear_sRGB } from '../wgsl/color/linear_displayP3_to_linear_sRGB.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_linear_sRGB_to_linear_displayP3 } from '../wgsl/color/linear_sRGB_to_linear_displayP3.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_is_color_in_range } from '../wgsl/color/is_color_in_range.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_gamut_map_linear_sRGB } from '../wgsl/color/gamut_map_linear_sRGB.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_gamut_map_linear_displayP3 } from '../wgsl/color/gamut_map_linear_displayP3.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_gamut_map_premul_sRGB } from '../wgsl/color/gamut_map_premul_sRGB.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_gamut_map_premul_displayP3 } from '../wgsl/color/gamut_map_premul_displayP3.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_matthes_drakopoulos_clip } from '../wgsl/clip/matthes_drakopoulos_clip.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_bounds_clip_edge } from '../wgsl/clip/bounds_clip_edge.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_bounds_double_area_edge } from '../wgsl/clip/bounds_double_area_edge.js';

export { default as PolygonFilterType, getPolygonFilterWidth, getPolygonFilterExtraPixels, getPolygonFilterGridOffset, getPolygonFilterMinExpand, getPolygonFilterMaxExpand, getPolygonFilterGridBounds } from './render-program/PolygonFilterType.js';
export { default as Mesh } from './render-program/Mesh.js';
export { default as RenderBlendType } from './render-program/RenderBlendType.js';
export { default as RenderComposeType } from './render-program/RenderComposeType.js';
export { default as RenderExtend } from './render-program/RenderExtend.js';
export { default as RenderProgramNeeds } from './render-program/RenderProgramNeeds.js';
export { default as RenderEvaluationContext } from './render-program/RenderEvaluationContext.js';
export { default as RenderExecutionStack } from './render-program/RenderExecutionStack.js';
export { default as RenderExecutor } from './render-program/RenderExecutor.js';
export { default as RenderInstruction, RenderInstructionLocation, RenderInstructionReturn, RenderInstructionPush, RenderInstructionMultiplyScalar } from './render-program/RenderInstruction.js';
export { default as RenderProgram } from './render-program/RenderProgram.js';
export type { RenderEvaluator } from './render-program/RenderProgram.js';
export type { SerializedRenderColorSpaceConversion } from './render-program/RenderColorSpaceConversion.js';
export type { SerializedRenderProgram } from './render-program/RenderProgram.js';
export { default as RenderPath } from './render-program/RenderPath.js';
export type { SerializedRenderPath } from './render-program/RenderPath.js';
export { default as RenderPathBoolean } from './render-program/RenderPathBoolean.js';
export type { SerializedRenderPathBoolean } from './render-program/RenderPathBoolean.js';
export { default as RenderColor } from './render-program/RenderColor.js';
export type { SerializedRenderColor } from './render-program/RenderColor.js';
export { default as RenderColorSpace } from './render-program/RenderColorSpace.js';
export { default as RenderColorSpaceConversion } from './render-program/RenderColorSpaceConversion.js';
export { default as RenderAlpha } from './render-program/RenderAlpha.js';
export type { SerializedRenderAlpha } from './render-program/RenderAlpha.js';
export { default as RenderNormalize, RenderInstructionNormalize } from './render-program/RenderNormalize.js';
export type { SerializedRenderNormalize } from './render-program/RenderNormalize.js';
export { default as RenderPremultiply, RenderInstructionPremultiply } from './render-program/RenderPremultiply.js';
export { default as RenderUnpremultiply, RenderInstructionUnpremultiply } from './render-program/RenderUnpremultiply.js';
export { default as RenderSRGBToLinearSRGB, RenderInstructionSRGBToLinearSRGB } from './render-program/RenderSRGBToLinearSRGB.js';
export { default as RenderLinearSRGBToSRGB, RenderInstructionLinearSRGBToSRGB } from './render-program/RenderLinearSRGBToSRGB.js';
export { default as RenderOklabToLinearSRGB, RenderInstructionOklabToLinearSRGB } from './render-program/RenderOklabToLinearSRGB.js';
export { default as RenderLinearSRGBToOklab, RenderInstructionLinearSRGBToOklab } from './render-program/RenderLinearSRGBToOklab.js';
export { default as RenderLinearDisplayP3ToLinearSRGB, RenderInstructionLinearDisplayP3ToLinearSRGB } from './render-program/RenderLinearDisplayP3ToLinearSRGB.js';
export { default as RenderLinearSRGBToLinearDisplayP3, RenderInstructionLinearSRGBToLinearDisplayP3 } from './render-program/RenderLinearSRGBToLinearDisplayP3.js';
export { default as RenderBlendCompose, RenderBlendComposeLogic, RenderInstructionBlendCompose } from './render-program/RenderBlendCompose.js';
export type { SerializedRenderBlendCompose } from './render-program/RenderBlendCompose.js';
export { default as RenderStack, RenderInstructionOpaqueJump, RenderInstructionStackBlend } from './render-program/RenderStack.js';
export type { SerializedRenderStack } from './render-program/RenderStack.js';
export { default as RenderPlanar } from './render-program/RenderPlanar.js';
export { default as RenderDepthSort } from './render-program/RenderDepthSort.js';
export type { SerializedRenderDepthSort } from './render-program/RenderDepthSort.js';
export { default as RenderLight } from './render-program/RenderLight.js';
export { default as RenderNormalDebug, RenderInstructionNormalDebug } from './render-program/RenderNormalDebug.js';
export type { SerializedRenderNormalDebug } from './render-program/RenderNormalDebug.js';
export { default as RenderPhong } from './render-program/RenderPhong.js';
export type { SerializedRenderPhong } from './render-program/RenderPhong.js';
export { default as RenderFilter, RenderFilterLogic, RenderInstructionFilter } from './render-program/RenderFilter.js';
export type { SerializedRenderFilter } from './render-program/RenderFilter.js';
export { default as RenderGradientStop } from './render-program/RenderGradientStop.js';
export type { SerializedRenderGradientStop } from './render-program/RenderGradientStop.js';
export { default as RenderLinearRange } from './render-program/RenderLinearRange.js';
export { default as RenderImage, RenderImageLogic, RenderInstructionImage } from './render-program/RenderImage.js';
export type { SerializedRenderImage } from './render-program/RenderImage.js';
export type { default as RenderImageable, SerializedRenderImageable } from './render-program/RenderImageable.js';
export { default as RenderLinearBlend, RenderLinearBlendAccuracy, RenderLinearBlendLogic, RenderInstructionComputeBlendRatio, RenderInstructionLinearBlend } from './render-program/RenderLinearBlend.js';
export type { SerializedRenderLinearBlend } from './render-program/RenderLinearBlend.js';
export { default as RenderBarycentricBlend, RenderBarycentricBlendLogic, RenderInstructionBarycentricBlend, RenderBarycentricBlendAccuracy } from './render-program/RenderBarycentricBlend.js';
export type { SerializedRenderBarycentricBlend } from './render-program/RenderBarycentricBlend.js';
export { default as RenderBarycentricPerspectiveBlend, RenderBarycentricPerspectiveBlendLogic, RenderBarycentricPerspectiveBlendAccuracy, RenderInstructionBarycentricPerspectiveBlend } from './render-program/RenderBarycentricPerspectiveBlend.js';
export type { SerializedRenderBarycentricPerspectiveBlend } from './render-program/RenderBarycentricPerspectiveBlend.js';
export { default as RenderLinearGradient, RenderLinearGradientAccuracy, RenderLinearGradientLogic, RenderInstructionComputeGradientRatio } from './render-program/RenderLinearGradient.js';
export type { SerializedRenderLinearGradient } from './render-program/RenderLinearGradient.js';
export { default as RenderRadialBlend, RenderRadialBlendLogic, RenderRadialBlendAccuracy } from './render-program/RenderRadialBlend.js';
export type { SerializedRenderRadialBlend } from './render-program/RenderRadialBlend.js';
export { default as RenderRadialGradient, RenderRadialGradientAccuracy, RenderRadialGradientLogic } from './render-program/RenderRadialGradient.js';
export type { SerializedRenderRadialGradient } from './render-program/RenderRadialGradient.js';
export { default as RenderResampleType } from './render-program/RenderResampleType.js';
export { isWindingIncluded } from './render-program/FillRule.js';
export type { default as FillRule } from './render-program/FillRule.js';
export { default as RenderTrail } from './render-program/RenderTrail.js';
export { default as RenderPathReplacer } from './render-program/RenderPathReplacer.js';
export { default as RenderFromNode } from './render-program/RenderFromNode.js';

export { default as LinearEdge } from './cag/LinearEdge.js';
export type { SerializedLinearEdge } from './cag/LinearEdge.js';

export { default as BigIntVector2 } from './cag/BigIntVector2.js';
export { default as BigRational } from './cag/BigRational.js';
export { default as BigRationalVector2 } from './cag/BigRationalVector2.js';
export { default as BoundsIntersectionFilter } from './cag/BoundsIntersectionFilter.js';
export { default as HilbertMapping, Hilbert2 } from './cag/HilbertMapping.js';

export { default as ClipSimplifier } from './clip/ClipSimplifier.js';

export { serializeClippableFace, deserializeClippableFace } from './cag/ClippableFace.js';
export type { default as ClippableFace, ClippableFaceAccumulator } from './cag/ClippableFace.js';
export { default as EdgedFace, EdgedFaceAccumulator } from './cag/EdgedFace.js';
export type { SerializedEdgedFace } from './cag/EdgedFace.js';
export { default as EdgedClippedFace, EdgedClippedFaceAccumulator } from './cag/EdgedClippedFace.js';
export type { SerializedEdgedClippedFace } from './cag/EdgedClippedFace.js';
export { default as PolygonalFace, PolygonalFaceAccumulator } from './cag/PolygonalFace.js';
export type { SerializedPolygonalFace } from './cag/PolygonalFace.js';
export { default as BoundedSubpath } from './cag/BoundedSubpath.js';

export { default as IntegerEdge } from './cag/IntegerEdge.js';
export { default as IntersectionPoint } from './cag/IntersectionPoint.js';
export { default as LineIntersector } from './cag/LineIntersector.js';
export { default as LineSplitter } from './cag/LineSplitter.js';
export { default as RationalBoundary } from './cag/RationalBoundary.js';
export { default as RationalFace } from './cag/RationalFace.js';
export { default as RationalHalfEdge } from './cag/RationalHalfEdge.js';
export { default as RationalIntersection } from './cag/RationalIntersection.js';
export { default as WindingMap } from './cag/WindingMap.js';
export { default as PolygonalBoolean } from './cag/PolygonalBoolean.js';

export { default as CohenSutherlandClipping } from './clip/CohenSutherlandClipping.js';
export { default as LineClipping } from './clip/LineClipping.js';
export { default as BoundsClipping } from './clip/BoundsClipping.js';
export { default as StripeClipping } from './clip/StripeClipping.js';
export { default as GridClipping } from './clip/GridClipping.js';
export type { GridClipCallback } from './clip/GridClipping.js';
export { default as CircularClipping } from './clip/CircularClipping.js';
export { default as BinaryClipping } from './clip/BinaryClipping.js';
export type { BinaryClipCallback, PolygonCompleteCallback, BinaryPolygonCompleteCallback } from './clip/BinaryClipping.js';

export { default as FaceConversion } from './cag/FaceConversion.js';

export type { default as RasterColorConverter } from './raster/RasterColorConverter.js';
export { default as RasterPremultipliedConverter } from './raster/RasterPremultipliedConverter.js';
export { default as CombinedRaster } from './raster/CombinedRaster.js';
export type { CombinedRasterOptions } from './raster/CombinedRaster.js';
export type { default as OutputRaster } from './raster/OutputRaster.js';
export { default as PolygonBilinear } from './raster/PolygonBilinear.js';
export { default as PolygonMitchellNetravali } from './raster/PolygonMitchellNetravali.js';
export { default as RenderableFace } from './raster/RenderableFace.js';
export { default as Rasterize } from './raster/Rasterize.js';
export type { RasterizationOptions } from './raster/Rasterize.js';
export { default as VectorCanvas } from './raster/VectorCanvas.js';
export { default as RasterLog, RasterTileLog } from './raster/RasterLog.js';

export { default as Snippet } from './webgpu/Snippet.js';
export { default as DualSnippet } from './webgpu/DualSnippet.js';
export type { DualSnippetSource } from './webgpu/DualSnippet.js';
export { default as DeviceContext } from './webgpu/DeviceContext.js';
export { default as Binding } from './webgpu/Binding.js';
export { default as ComputeShader } from './webgpu/ComputeShader.js';
export { default as BlitShader } from './webgpu/BlitShader.js';
export { default as ByteEncoder } from './webgpu/ByteEncoder.js';
export type { F32, U32, U8 } from './webgpu/ByteEncoder.js';
export { default as TestToCanvas } from './webgpu/TestToCanvas.js';

