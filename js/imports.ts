// Copyright 2023-2024, University of Colorado Boulder

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

export { default as u32 } from './webgpu/compute/u32.js';
export { default as u32Hex } from './webgpu/compute/u32Hex.js';
export { default as i32 } from './webgpu/compute/i32.js';
export { default as i32Hex } from './webgpu/compute/i32Hex.js';
export { default as f32 } from './webgpu/compute/f32.js';
export { default as decimal } from './webgpu/compute/decimal.js';

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
export { default as wgsl_blend_compose } from '../wgsl/color/blend_compose.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_matthes_drakopoulos_clip } from '../wgsl/clip/matthes_drakopoulos_clip.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_bounds_clip_edge } from '../wgsl/clip/bounds_clip_edge.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_bounds_double_area_edge } from '../wgsl/clip/bounds_double_area_edge.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_evaluate_render_program_instructions } from '../wgsl/render-program/evaluate_render_program_instructions.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_extend_f32 } from '../wgsl/render-program/extend_f32.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_extend_i32 } from '../wgsl/render-program/extend_i32.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_inclusive_to_exclusive_scan_indices } from '../wgsl/utils/inclusive_to_exclusive_scan_indices.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterChunk } from '../wgsl/raster/RasterChunk.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterClippedChunk } from '../wgsl/raster/RasterClippedChunk.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterEdge } from '../wgsl/raster/RasterEdge.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterEdgeClip } from '../wgsl/raster/RasterEdgeClip.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterChunkReduceData } from '../wgsl/raster/RasterChunkReduceData.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterChunkReducePair } from '../wgsl/raster/RasterChunkReducePair.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterChunkReduceQuad } from '../wgsl/raster/RasterChunkReduceQuad.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterCompleteChunk } from '../wgsl/raster/RasterCompleteChunk.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterCompleteEdge } from '../wgsl/raster/RasterCompleteEdge.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterSplitReduceData } from '../wgsl/raster/RasterSplitReduceData.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_RasterStageConfig } from '../wgsl/raster/RasterStageConfig.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_apply_to_clipped_chunk } from '../wgsl/raster/apply_to_clipped_chunk.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_clipped_chunk_info } from '../wgsl/raster/clipped_chunk_info.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_initial_chunk } from '../wgsl/raster/raster_initial_chunk.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_initial_clip } from '../wgsl/raster/raster_initial_clip.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_chunk_reduce } from '../wgsl/raster/raster_chunk_reduce.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_initial_split_reduce } from '../wgsl/raster/raster_initial_split_reduce.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_initial_edge_reduce } from '../wgsl/raster/raster_initial_edge_reduce.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_split_reduce } from '../wgsl/raster/raster_split_reduce.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_split_scan } from '../wgsl/raster/raster_split_scan.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_edge_scan } from '../wgsl/raster/raster_edge_scan.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_chunk_index_patch } from '../wgsl/raster/raster_chunk_index_patch.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_uniform_update } from '../wgsl/raster/raster_uniform_update.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_edge_index_patch } from '../wgsl/raster/raster_edge_index_patch.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_accumulate } from '../wgsl/raster/raster_accumulate.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_raster_to_texture } from '../wgsl/raster/raster_to_texture.js';

// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_test_to_canvas } from '../wgsl/tests/test_to_canvas.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_test_render_program } from '../wgsl/tests/test_render_program.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_expensive_operation } from '../wgsl/tests/expensive_operation.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_fake_combine_to_texture } from '../wgsl/tests/fake_combine_to_texture.js';
// @ts-expect-error WILL BE FILLED IN BY TRANSPILER
export { default as wgsl_copy_storage_operation } from '../wgsl/tests/copy_storage_operation.js';

export { default as PolygonFilterType, getPolygonFilterWidth, getPolygonFilterExtraPixels, getPolygonFilterGridOffset, getPolygonFilterMinExpand, getPolygonFilterMaxExpand, getPolygonFilterGridBounds } from './render-program/PolygonFilterType.js';
export { default as Mesh } from './render-program/Mesh.js';
export { default as RenderBlendType, RENDER_BLEND_CONSTANTS } from './render-program/RenderBlendType.js';
export { default as RenderComposeType, RENDER_COMPOSE_CONSTANTS } from './render-program/RenderComposeType.js';
export { default as RenderExtend, RENDER_EXTEND_CONSTANTS } from './render-program/RenderExtend.js';
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
export { default as RenderPhong, RenderInstructionPhong } from './render-program/RenderPhong.js';
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
export { default as RenderRadialGradient, RenderRadialGradientAccuracy, RenderRadialGradientLogic, RENDER_GRADIENT_TYPE_CONSTANTS, RadialGradientType } from './render-program/RenderRadialGradient.js';
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

export { default as ParallelContext } from './parallel/ParallelContext.js';
export type { BaseWorkgroupValues } from './parallel/ParallelContext.js';
export { default as ParallelKernel } from './parallel/ParallelKernel.js';
export { default as ParallelWorkgroup } from './parallel/ParallelWorkgroup.js';
export { default as ParallelExecutor } from './parallel/ParallelExecutor.js';
export { default as ParallelStorageArray } from './parallel/ParallelStorageArray.js';
export { default as ParallelWorkgroupArray } from './parallel/ParallelWorkgroupArray.js';
export { default as ParallelUtils } from './parallel/ParallelUtils.js';

export { default as RasterChunk } from './parallel/raster-clip/RasterChunk.js';
export { default as RasterChunkReduceData } from './parallel/raster-clip/RasterChunkReduceData.js';
export { default as RasterChunkReducePair } from './parallel/raster-clip/RasterChunkReducePair.js';
export { default as RasterChunkReduceQuad } from './parallel/raster-clip/RasterChunkReduceQuad.js';
export { default as RasterCompleteChunk } from './parallel/raster-clip/RasterCompleteChunk.js';
export { default as RasterEdge } from './parallel/raster-clip/RasterEdge.js';
export { default as RasterEdgeClip } from './parallel/raster-clip/RasterEdgeClip.js';
export { default as RasterCompleteEdge } from './parallel/raster-clip/RasterCompleteEdge.js';
export { default as RasterClippedChunk } from './parallel/raster-clip/RasterClippedChunk.js';
export { default as RasterSplitReduceData } from './parallel/raster-clip/RasterSplitReduceData.js';
export { default as ParallelRasterInitialChunk } from './parallel/raster-clip/ParallelRasterInitialChunk.js';
export { default as ParallelRasterInitialClip } from './parallel/raster-clip/ParallelRasterInitialClip.js';
export { default as ParallelRasterChunkReduce } from './parallel/raster-clip/ParallelRasterChunkReduce.js';
export { default as ParallelRasterInitialEdgeReduce } from './parallel/raster-clip/ParallelRasterInitialEdgeReduce.js';
export { default as ParallelRasterSplitReduce } from './parallel/raster-clip/ParallelRasterSplitReduce.js';
export { default as ParallelRasterEdgeScan } from './parallel/raster-clip/ParallelRasterEdgeScan.js';
export { default as ParallelRasterInitialSplitReduce } from './parallel/raster-clip/ParallelRasterInitialSplitReduce.js';
export { default as ParallelRasterSplitScan } from './parallel/raster-clip/ParallelRasterSplitScan.js';
export { default as ParallelRasterChunkIndexPatch } from './parallel/raster-clip/ParallelRasterChunkIndexPatch.js';
export { default as ParallelRasterEdgeIndexPatch } from './parallel/raster-clip/ParallelRasterEdgeIndexPatch.js';
export { default as ParallelRaster } from './parallel/raster-clip/ParallelRaster.js';

export { default as WGSLString, WGSLStringLiteral, WGSLStringFunction, WGSLStringAccumulator, WGSLModule, WGSLMainModule, WGSLReferenceModule, WGSLStringModule, WGSLSlot, wgslString, wgslFunction, wgslBlueprint, wgsl, decimalS, u32S, u32HexS, i32S, i32HexS, f32S, wgslJoin, wgslMapJoin, wgslOneLine, wgslWith } from './webgpu/wgsl/WGSLString.js';
export type { WGSLExpression, WGSLExpressionU32, WGSLExpressionI32, WGSLExpressionF32, WGSLExpressionBool, WGSLExpressionT, WGSLStatements, WGSLModuleDeclarations, WGSLVariableName, WGSLType, WGSLBinaryExpression } from './webgpu/wgsl/WGSLString.js';

export { default as WebGPURecorder, WebGPUCommand } from './webgpu/WebGPURecorder.js';
export { default as WebGPUAPI, webgpu } from './webgpu/WebGPUAPI.js';
export type { PreferredCanvasFormat } from './webgpu/WebGPUAPI.js';
export { default as OldSnippet } from './webgpu/old/OldSnippet.js';
export { default as OldDualSnippet } from './webgpu/old/OldDualSnippet.js';
export type { OldDualSnippetSource } from './webgpu/old/OldDualSnippet.js';
export { default as DeviceContext } from './webgpu/compute/DeviceContext.js';
export type { DeviceContextDeviceOptions } from './webgpu/compute/DeviceContext.js';
export { BaseExecution, BasicExecution, ExecutableShader } from './webgpu/old/OldExecution.js';
export type { default as OldExecution, ExecutionOptions, ExecutableShaderTemplate, ExecutableShaderOptions, ExecutionSingleCallback, ExecutionMultipleCallback, Unpromised, ExecutableShaderExternalOptions } from './webgpu/old/OldExecution.js';
export { default as OldBindingType } from './webgpu/old/OldBindingType.js';
export { default as OldComputeShader } from './webgpu/old/OldComputeShader.js';
export type { OldComputeShaderOptions, OldComputeShaderDispatchOptions, OldComputeShaderSourceOptions } from './webgpu/old/OldComputeShader.js';
export { default as BlitShader } from './webgpu/BlitShader.js';
export { default as ByteEncoder } from './webgpu/compute/ByteEncoder.js';
export type { F32, U32, I32, U8 } from './webgpu/compute/ByteEncoder.js';
export { U32Type, U32Add, U32Min, U32Max, U32And, U32Or, U32Xor, U32Order, U32ReverseOrder, I32Type, Vec2uType, Vec2uBic, Vec3uType, Vec4uType, Vec2uLexicographicalOrder, I32Order, I32Add, I32Min, I32Max, I32And, I32Or, I32Xor, F32Type, F32Order, getArrayType, getCastedType, Vec2uAdd, Vec3uAdd, Vec4uAdd, U32AtomicType, I32AtomicType, U32_IDENTITY_VALUES, I32_IDENTITY_VALUES } from './webgpu/compute/ConcreteType.js';
export type { default as ConcreteType, ConcreteArrayType, BinaryOp, BitOrder, CompareOrder, Order, WGSLBinaryStatements, StoreStatementCallback } from './webgpu/compute/ConcreteType.js';
export { default as ConsoleLogger, ConsoleLoggedEntry, ConsoleLoggedThread, ConsoleLoggedLine, ConsoleLoggedShader } from './webgpu/compute/ConsoleLogger.js';
export type { ConsoleLogInfo } from './webgpu/compute/ConsoleLogger.js';
export { default as BufferLogger } from './webgpu/compute/BufferLogger.js';
export type { FromArrayBufferable, FromMultiArrayBufferable } from './webgpu/compute/BufferLogger.js';
export { default as TimestampLogger, TimestampLoggerResult } from './webgpu/compute/TimestampLogger.js';
export { default as TypedBuffer } from './webgpu/compute/TypedBuffer.js';
export { default as BindingLocation } from './webgpu/compute/BindingLocation.js';

export { default as BindingType } from './webgpu/compute/BindingType.js';
export { default as BufferBindingType } from './webgpu/compute/BufferBindingType.js';
export { default as StorageTextureBindingType } from './webgpu/compute/StorageTextureBindingType.js';
export { default as TextureBindingType } from './webgpu/compute/TextureBindingType.js';
export { default as ConcreteBindingType } from './webgpu/compute/ConcreteBindingType.js';
export { default as ResourceSlot } from './webgpu/compute/ResourceSlot.js';
export { default as BufferSlotSlice } from './webgpu/compute/BufferSlotSlice.js';
export { default as BufferSlot } from './webgpu/compute/BufferSlot.js';
export { default as BufferArraySlot } from './webgpu/compute/BufferArraySlot.js';
export { default as TextureViewSlot } from './webgpu/compute/TextureViewSlot.js';
export { default as Resource } from './webgpu/compute/Resource.js';
export { default as BufferResource } from './webgpu/compute/BufferResource.js';
export { default as TextureViewResource } from './webgpu/compute/TextureViewResource.js';
export { default as ResourceUsage } from './webgpu/compute/ResourceUsage.js';
export { default as BindingDescriptor } from './webgpu/compute/BindingDescriptor.js';
export { default as Binding } from './webgpu/compute/Binding.js';
export { default as BufferBinding } from './webgpu/compute/BufferBinding.js';
export { default as BindGroupLayout } from './webgpu/compute/BindGroupLayout.js';
export { default as PipelineLayout } from './webgpu/compute/PipelineLayout.js';
export { default as PipelineBlueprint, PIPELINE_BLUEPRINT_DEFAULTS } from './webgpu/compute/PipelineBlueprint.js';
export type { PipelineBlueprintOptions } from './webgpu/compute/PipelineBlueprint.js';
export { default as Module } from './webgpu/compute/Module.js';
export { default as DirectModule, DIRECT_MODULE_DEFAULTS } from './webgpu/compute/DirectModule.js';
export type { DirectModuleOptions } from './webgpu/compute/DirectModule.js';
export { default as IndirectModule, INDIRECT_MODULE_DEFAULTS } from './webgpu/compute/IndirectModule.js';
export type { IndirectModuleOptions } from './webgpu/compute/IndirectModule.js';
export { default as CompositeModule } from './webgpu/compute/CompositeModule.js';
export { default as Routine } from './webgpu/compute/Routine.js';
export { default as Procedure } from './webgpu/compute/Procedure.js';
export type { ProcedureExecuteOptions } from './webgpu/compute/Procedure.js';
export { default as BindGroup } from './webgpu/compute/BindGroup.js';
export { default as ComputePipeline } from './webgpu/compute/ComputePipeline.js';
export { default as ComputePass } from './webgpu/compute/ComputePass.js';
export { default as ExecutionContext } from './webgpu/compute/ExecutionContext.js';
export { default as Executor } from './webgpu/compute/Executor.js';
export type { ExecutorOptions } from './webgpu/compute/Executor.js';

export { partialWGSLBeautify, addLineNumbers, stripWGSLComments, GLOBAL_INDEXABLE_DEFAULTS, WORKGROUP_INDEXABLE_DEFAULTS, LOCAL_INDEXABLE_DEFAULTS, OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS } from './webgpu/wgsl/WGSLUtils.js';
export type { GlobalIndexable, WorkgroupIndexable, LocalIndexable, WorkgroupSizable, RakedSizable, OptionalLengthExpressionable, GrainSizable } from './webgpu/wgsl/WGSLUtils.js';

export { default as binaryExpressionStatementWGSL } from './webgpu/wgsl/gpu/binaryExpressionStatementWGSL.js';
export { default as coalescedLoopWGSL, COALESCED_LOOP_DEFAULTS } from './webgpu/wgsl/gpu/coalescedLoopWGSL.js';
export type { coalescedLoopWGSLOptions } from './webgpu/wgsl/gpu/coalescedLoopWGSL.js';
export { default as commentWGSL } from './webgpu/wgsl/gpu/commentWGSL.js';
export { default as conditionalIfWGSL } from './webgpu/wgsl/gpu/conditionalIfWGSL.js';
export { default as fromStripedIndexWGSL } from './webgpu/wgsl/gpu/fromStripedIndexWGSL.js';
export type { fromStripedIndexWGSLOptions } from './webgpu/wgsl/gpu/fromStripedIndexWGSL.js';
export { default as getConvergentIndexWGSL, toConvergentIndexWGSL, fromConvergentIndexWGSL } from './webgpu/wgsl/gpu/getConvergentIndexWGSL.js';
export type { getConvergentIndexWGSLOptions } from './webgpu/wgsl/gpu/getConvergentIndexWGSL.js';
export { default as loadMultipleWGSL, LOAD_MULTIPLE_DEFAULTS } from './webgpu/wgsl/gpu/loadMultipleWGSL.js';
export type { loadMultipleWGSLOptions } from './webgpu/wgsl/gpu/loadMultipleWGSL.js';
export { default as loadReducedWGSL, LOAD_REDUCED_DEFAULTS } from './webgpu/wgsl/gpu/loadReducedWGSL.js';
export type { loadReducedWGSLOptions } from './webgpu/wgsl/gpu/loadReducedWGSL.js';
export { default as logWGSL, LOG_DEFAULTS } from './webgpu/wgsl/gpu/logWGSL.js';
export type { logWGSLOptions } from './webgpu/wgsl/gpu/logWGSL.js';
export { default as logRakedWGSL, LOG_RAKED_OPTIONS } from './webgpu/wgsl/gpu/logRakedWGSL.js';
export type { logRakedWGSLOptions } from './webgpu/wgsl/gpu/logRakedWGSL.js';
export { default as logValueWGSL } from './webgpu/wgsl/gpu/logValueWGSL.js';
export type { logValueWGSLOptions } from './webgpu/wgsl/gpu/logValueWGSL.js';
export { default as logStringWGSL } from './webgpu/wgsl/gpu/logStringWGSL.js';
export { default as mainLogBarrier } from './webgpu/wgsl/gpu/mainLogBarrier.js';
export { default as mainReduceWGSL, MAIN_REDUCE_DEFAULTS } from './webgpu/wgsl/gpu/mainReduceWGSL.js';
export type { mainReduceWGSLOptions } from './webgpu/wgsl/gpu/mainReduceWGSL.js';
export { default as reduceWGSL, REDUCE_DEFAULTS } from './webgpu/wgsl/gpu/reduceWGSL.js';
export type { reduceWGSLOptions } from './webgpu/wgsl/gpu/reduceWGSL.js';
export { default as scanWGSL, SCAN_DEFAULTS } from './webgpu/wgsl/gpu/scanWGSL.js';
export type { scanWGSLOptions } from './webgpu/wgsl/gpu/scanWGSL.js';
export { default as scanRakedWGSL, SCAN_RAKED_DEFAULTS } from './webgpu/wgsl/gpu/scanRakedWGSL.js';
export type { scanRakedWGSLOptions } from './webgpu/wgsl/gpu/scanRakedWGSL.js';
export { default as toStripedIndexWGSL } from './webgpu/wgsl/gpu/toStripedIndexWGSL.js';
export type { toStripedIndexWGSLOptions } from './webgpu/wgsl/gpu/toStripedIndexWGSL.js';
export { default as unrollWGSL } from './webgpu/wgsl/gpu/unrollWGSL.js';
export { default as bitPackRadixAccessWGSL } from './webgpu/wgsl/gpu/bitPackRadixAccessWGSL.js';
export type { bitPackRadixAccessWGSLOptions } from './webgpu/wgsl/gpu/bitPackRadixAccessWGSL.js';
export { default as bitPackRadixExclusiveScanWGSL } from './webgpu/wgsl/gpu/bitPackRadixExclusiveScanWGSL.js';
export type { bitPackRadixExclusiveScanWGSLOptions } from './webgpu/wgsl/gpu/bitPackRadixExclusiveScanWGSL.js';
export { default as bitPackRadixIncrementWGSL } from './webgpu/wgsl/gpu/bitPackRadixIncrementWGSL.js';
export type { bitPackRadixIncrementWGSLOptions } from './webgpu/wgsl/gpu/bitPackRadixIncrementWGSL.js';
export { default as ceilDivideWGSL } from './webgpu/wgsl/gpu/ceilDivideWGSL.js';
export { default as ceilDivideConstantDivisorWGSL } from './webgpu/wgsl/gpu/ceilDivideConstantDivisorWGSL.js';
export { default as nBitCompactSingleSortWGSL } from './webgpu/wgsl/gpu/nBitCompactSingleSortWGSL.js';
export type { nBitCompactSingleSortWGSLOptions } from './webgpu/wgsl/gpu/nBitCompactSingleSortWGSL.js';
export { default as compactSingleRadixSortWGSL } from './webgpu/wgsl/gpu/compactSingleRadixSortWGSL.js';
export type { compactSingleRadixSortWGSLOptions } from './webgpu/wgsl/gpu/compactSingleRadixSortWGSL.js';
export { default as getCorankWGSL, GET_CORANK_DEFAULTS } from './webgpu/wgsl/gpu/getCorankWGSL.js';
export type { getCorankWGSLOptions } from './webgpu/wgsl/gpu/getCorankWGSL.js';
export { default as histogramWGSL, HISTOGRAM_DEFAULTS } from './webgpu/wgsl/gpu/histogramWGSL.js';
export type { histogramWGSLOptions } from './webgpu/wgsl/gpu/histogramWGSL.js';
export { default as radixHistogramWGSL } from './webgpu/wgsl/gpu/radixHistogramWGSL.js';
export type { radixHistogramWGSLOptions } from './webgpu/wgsl/gpu/radixHistogramWGSL.js';
export { default as mainRadixHistogramWGSL, MAIN_RADIX_HISTOGRAM_DEFAULTS } from './webgpu/wgsl/gpu/mainRadixHistogramWGSL.js';
export type { mainRadixHistogramWGSLOptions } from './webgpu/wgsl/gpu/mainRadixHistogramWGSL.js';
export { default as mainRadixScatterWGSL, MAIN_RADIX_SCATTER_DEFAULTS } from './webgpu/wgsl/gpu/mainRadixScatterWGSL.js';
export type { mainRadixScatterWGSLOptions } from './webgpu/wgsl/gpu/mainRadixScatterWGSL.js';
export { default as mainReduceAtomicWGSL, MAIN_REDUCE_ATOMIC_DEFAULTS } from './webgpu/wgsl/gpu/mainReduceAtomicWGSL.js';
export type { mainReduceAtomicWGSLOptions } from './webgpu/wgsl/gpu/mainReduceAtomicWGSL.js';
export { default as mainReduceNonCommutativeWGSL, MAIN_REDUCE_NON_COMMUTATIVE_DEFAULTS } from './webgpu/wgsl/gpu/mainReduceNonCommutativeWGSL.js';
export type { mainReduceNonCommutativeWGSLOptions } from './webgpu/wgsl/gpu/mainReduceNonCommutativeWGSL.js';
export { default as scanComprehensiveWGSL, SCAN_COMPREHENSIVE_DEFAULTS } from './webgpu/wgsl/gpu/scanComprehensiveWGSL.js';
export type { scanComprehensiveWGSLOptions } from './webgpu/wgsl/gpu/scanComprehensiveWGSL.js';
export { default as mergeSequentialWGSL, MERGE_SEQUENTIAL_DEFAULTS } from './webgpu/wgsl/gpu/mergeSequentialWGSL.js';
export type { mergeSequentialWGSLOptions } from './webgpu/wgsl/gpu/mergeSequentialWGSL.js';
export { default as mergeSimpleWGSL, MERGE_SIMPLE_DEFAULTS } from './webgpu/wgsl/gpu/mergeSimpleWGSL.js';
export type { mergeSimpleWGSLOptions } from './webgpu/wgsl/gpu/mergeSimpleWGSL.js';
export { default as mergeWGSL, MERGE_DEFAULTS } from './webgpu/wgsl/gpu/mergeWGSL.js';
export type { mergeWGSLOptions } from './webgpu/wgsl/gpu/mergeWGSL.js';
export { default as mainScanWGSL, MAIN_SCAN_DEFAULTS } from './webgpu/wgsl/gpu/mainScanWGSL.js';
export type { mainScanWGSLOptions } from './webgpu/wgsl/gpu/mainScanWGSL.js';
export { default as mainMergeSimpleWGSL, MAIN_MERGE_SIMPLE_DEFAULTS } from './webgpu/wgsl/gpu/mainMergeSimpleWGSL.js';
export type { mainMergeSimpleWGSLOptions } from './webgpu/wgsl/gpu/mainMergeSimpleWGSL.js';
export { default as mainMergeWGSL, MAIN_MERGE_DEFAULTS } from './webgpu/wgsl/gpu/mainMergeWGSL.js';
export type { mainMergeWGSLOptions } from './webgpu/wgsl/gpu/mainMergeWGSL.js';
export { default as mainHistogramWGSL, MAIN_HISTOGRAM_DEFAULTS } from './webgpu/wgsl/gpu/mainHistogramWGSL.js';
export type { mainHistogramWGSLOptions } from './webgpu/wgsl/gpu/mainHistogramWGSL.js';

// math
export { default as cbrtWGSL } from './webgpu/wgsl/math/cbrtWGSL.js';
export { default as u64WGSL } from './webgpu/wgsl/math/u64WGSL.js';
export { default as i64WGSL } from './webgpu/wgsl/math/i64WGSL.js';
export { default as q128WGSL } from './webgpu/wgsl/math/q128WGSL.js';
export { default as i32_to_i64WGSL } from './webgpu/wgsl/math/i32_to_i64WGSL.js';
export { default as ZERO_u64WGSL } from './webgpu/wgsl/math/ZERO_u64WGSL.js';
export { default as ONE_u64WGSL } from './webgpu/wgsl/math/ONE_u64WGSL.js';
export { default as ZERO_q128WGSL } from './webgpu/wgsl/math/ZERO_q128WGSL.js';
export { default as ONE_q128WGSL } from './webgpu/wgsl/math/ONE_q128WGSL.js';
export { default as u32_to_u64WGSL } from './webgpu/wgsl/math/u32_to_u64WGSL.js';
export { default as add_u32_u32_to_u64WGSL } from './webgpu/wgsl/math/add_u32_u32_to_u64WGSL.js';
export { default as mul_u32_u32_to_u64WGSL } from './webgpu/wgsl/math/mul_u32_u32_to_u64WGSL.js';
export { default as add_u64_u64WGSL } from './webgpu/wgsl/math/add_u64_u64WGSL.js';
export { default as add_i64_i64WGSL } from './webgpu/wgsl/math/add_i64_i64WGSL.js';
export { default as negate_i64WGSL } from './webgpu/wgsl/math/negate_i64WGSL.js';
export { default as is_zero_u64WGSL } from './webgpu/wgsl/math/is_zero_u64WGSL.js';
export { default as is_negative_i64WGSL } from './webgpu/wgsl/math/is_negative_i64WGSL.js';
export { default as abs_i64WGSL } from './webgpu/wgsl/math/abs_i64WGSL.js';
export { default as left_shift_u64WGSL } from './webgpu/wgsl/math/left_shift_u64WGSL.js';
export { default as right_shift_u64WGSL } from './webgpu/wgsl/math/right_shift_u64WGSL.js';
export { default as first_leading_bit_u64WGSL } from './webgpu/wgsl/math/first_leading_bit_u64WGSL.js';
export { default as first_trailing_bit_u64WGSL } from './webgpu/wgsl/math/first_trailing_bit_u64WGSL.js';
export { default as subtract_i64_i64WGSL } from './webgpu/wgsl/math/subtract_i64_i64WGSL.js';
export { default as cmp_u64_u64WGSL } from './webgpu/wgsl/math/cmp_u64_u64WGSL.js';
export { default as cmp_i64_i64WGSL } from './webgpu/wgsl/math/cmp_i64_i64WGSL.js';
export { default as mul_u64_u64WGSL } from './webgpu/wgsl/math/mul_u64_u64WGSL.js';
export { default as mul_i64_i64WGSL } from './webgpu/wgsl/math/mul_i64_i64WGSL.js';
export { default as div_u64_u64WGSL } from './webgpu/wgsl/math/div_u64_u64WGSL.js';
export { default as gcd_u64_u64WGSL } from './webgpu/wgsl/math/gcd_u64_u64WGSL.js';
export { default as i64_to_q128WGSL } from './webgpu/wgsl/math/i64_to_q128WGSL.js';
export { default as whole_i64_to_q128WGSL } from './webgpu/wgsl/math/whole_i64_to_q128WGSL.js';
export { default as equals_cross_mul_q128WGSL } from './webgpu/wgsl/math/equals_cross_mul_q128WGSL.js';
export { default as is_zero_q128WGSL } from './webgpu/wgsl/math/is_zero_q128WGSL.js';
export { default as ratio_test_q128WGSL } from './webgpu/wgsl/math/ratio_test_q128WGSL.js';
export { default as reduce_q128WGSL } from './webgpu/wgsl/math/reduce_q128WGSL.js';
export { default as IntersectionPointWGSL } from './webgpu/wgsl/math/IntersectionPointWGSL.js';
export { default as LineSegmentIntersectionWGSL } from './webgpu/wgsl/math/LineSegmentIntersectionWGSL.js';
export { default as intersect_line_segmentsWGSL } from './webgpu/wgsl/math/intersect_line_segmentsWGSL.js';

// color
export { default as premultiplyWGSL } from './webgpu/wgsl/color/premultiplyWGSL.js';
export { default as unpremultiplyWGSL } from './webgpu/wgsl/color/unpremultiplyWGSL.js';
export { default as sRGB_to_linear_sRGBWGSL } from './webgpu/wgsl/color/sRGB_to_linear_sRGBWGSL.js';
export { default as linear_sRGB_to_sRGBWGSL } from './webgpu/wgsl/color/linear_sRGB_to_sRGBWGSL.js';
export { default as linear_sRGB_to_oklabWGSL } from './webgpu/wgsl/color/linear_sRGB_to_oklabWGSL.js';
export { default as oklab_to_linear_sRGBWGSL } from './webgpu/wgsl/color/oklab_to_linear_sRGBWGSL.js';
export { default as linear_displayP3_to_linear_sRGBWGSL } from './webgpu/wgsl/color/linear_displayP3_to_linear_sRGBWGSL.js';
export { default as linear_sRGB_to_linear_displayP3WGSL } from './webgpu/wgsl/color/linear_sRGB_to_linear_displayP3WGSL.js';
export { default as is_color_in_rangeWGSL } from './webgpu/wgsl/color/is_color_in_rangeWGSL.js';
export { default as gamut_map_linear_sRGBWGSL } from './webgpu/wgsl/color/gamut_map_linear_sRGBWGSL.js';
export { default as gamut_map_linear_displayP3WGSL } from './webgpu/wgsl/color/gamut_map_linear_displayP3WGSL.js';
export { default as gamut_map_premul_sRGBWGSL } from './webgpu/wgsl/color/gamut_map_premul_sRGBWGSL.js';
export { default as gamut_map_premul_displayP3WGSL } from './webgpu/wgsl/color/gamut_map_premul_displayP3WGSL.js';
export { default as blend_composeWGSL } from './webgpu/wgsl/color/blend_composeWGSL.js';

// cag/clip
export { default as LinearEdgeWGSL } from './webgpu/wgsl/cag/LinearEdgeWGSL.js';
export { default as LinearEdgeType } from './webgpu/wgsl/cag/LinearEdgeType.js';
export { default as matthes_drakopoulos_clipWGSL, MD_ClipResultWGSL } from './webgpu/wgsl/clip/matthes_drakopoulos_clipWGSL.js';
export { default as bounds_clip_edgeWGSL, bounds_clip_edge_ResultWGSL } from './webgpu/wgsl/clip/bounds_clip_edgeWGSL.js';

// render-program
export { default as extend_f32WGSL } from './webgpu/wgsl/render-program/extend_f32WGSL.js';
export { default as extend_i32WGSL } from './webgpu/wgsl/render-program/extend_i32WGSL.js';
export { default as evaluate_render_program_instructionsWGSL } from './webgpu/wgsl/render-program/evaluate_render_program_instructionsWGSL.js';

// "main" modules (a single pipeline each)
export { default as MainReduceModule, MAIN_REDUCE_MODULE_DEFAULTS } from './webgpu/modules/gpu/MainReduceModule.js';
export type { MainReduceModuleOptions } from './webgpu/modules/gpu/MainReduceModule.js';
export { default as MainReduceNonCommutativeModule, MAIN_REDUCE_NON_COMMUTATIVE_MODULE_DEFAULTS } from './webgpu/modules/gpu/MainReduceNonCommutativeModule.js';
export type { MainReduceNonCommutativeModuleOptions } from './webgpu/modules/gpu/MainReduceNonCommutativeModule.js';
export { default as MainReduceAtomicModule, MAIN_REDUCE_ATOMIC_MODULE_DEFAULTS } from './webgpu/modules/gpu/MainReduceAtomicModule.js';
export type { MainReduceAtomicModuleOptions } from './webgpu/modules/gpu/MainReduceAtomicModule.js';
export { default as MainScanModule, MAIN_SCAN_MODULE_DEFAULTS } from './webgpu/modules/gpu/MainScanModule.js';
export type { MainScanModuleOptions } from './webgpu/modules/gpu/MainScanModule.js';
export { default as MainRadixHistogramModule, MAIN_RADIX_HISTOGRAM_MODULE_DEFAULTS } from './webgpu/modules/gpu/MainRadixHistogramModule.js';
export type { MainRadixHistogramModuleOptions } from './webgpu/modules/gpu/MainRadixHistogramModule.js';
export { default as MainRadixScatterModule, MAIN_RADIX_SCATTER_MODULE_DEFAULTS } from './webgpu/modules/gpu/MainRadixScatterModule.js';
export type { MainRadixScatterModuleOptions } from './webgpu/modules/gpu/MainRadixScatterModule.js';

// "composite" modules
export { default as ReduceModule, REDUCE_MODULE_DEFAULTS } from './webgpu/modules/gpu/ReduceModule.js';
export type { ReduceModuleOptions } from './webgpu/modules/gpu/ReduceModule.js';
export { default as ScanModule, SCAN_MODULE_DEFAULTS } from './webgpu/modules/gpu/ScanModule.js';
export type { ScanModuleOptions } from './webgpu/modules/gpu/ScanModule.js';
export { default as RadixSortModule, RADIX_SORT_MODULE_DEFAULTS, getMaxRadixBitsPerInnerPass, getRadixBitVectorSize } from './webgpu/modules/gpu/RadixSortModule.js';
export type { RadixSortModuleOptions } from './webgpu/modules/gpu/RadixSortModule.js';
export { default as MergeSimpleModule, MERGE_SIMPLE_MODULE_DEFAULTS } from './webgpu/modules/gpu/MergeSimpleModule.js';
export type { MergeSimpleModuleOptions } from './webgpu/modules/gpu/MergeSimpleModule.js';
export { default as MergeModule, MERGE_MODULE_DEFAULTS } from './webgpu/modules/gpu/MergeModule.js';
export type { MergeModuleOptions } from './webgpu/modules/gpu/MergeModule.js';
export { default as HistogramModule, HISTOGRAM_MODULE_DEFAULTS } from './webgpu/modules/gpu/HistogramModule.js';
export type { HistogramModuleOptions } from './webgpu/modules/gpu/HistogramModule.js';

// rasterize-two-pass
export type { default as TwoPassConfig } from './webgpu/wgsl/rasterize-two-pass/TwoPassConfig.js';
export { default as TwoPassConfigWGSL } from './webgpu/wgsl/rasterize-two-pass/TwoPassConfigWGSL.js';
export { default as TwoPassConfigType } from './webgpu/wgsl/rasterize-two-pass/TwoPassConfigType.js';
export type { default as TwoPassFineRenderableFace } from './webgpu/wgsl/rasterize-two-pass/TwoPassFineRenderableFace.js';
export { default as TwoPassFineRenderableFaceWGSL } from './webgpu/wgsl/rasterize-two-pass/TwoPassFineRenderableFaceWGSL.js';
export { default as TwoPassFineRenderableFaceType } from './webgpu/wgsl/rasterize-two-pass/TwoPassFineRenderableFaceType.js';
export type { default as TwoPassCoarseRenderableFace } from './webgpu/wgsl/rasterize-two-pass/TwoPassCoarseRenderableFace.js';
export { default as TwoPassCoarseRenderableFaceWGSL } from './webgpu/wgsl/rasterize-two-pass/TwoPassCoarseRenderableFaceWGSL.js';
export { default as TwoPassCoarseRenderableFaceType } from './webgpu/wgsl/rasterize-two-pass/TwoPassCoarseRenderableFaceType.js';
export { default as mainTwoPassInitializeAddressesWGSL, MAIN_TWO_PASS_INITIALIZE_ADDRESSES_DEFAULTS } from './webgpu/wgsl/rasterize-two-pass/mainTwoPassInitializeAddressesWGSL.js';
export type { mainTwoPassInitializeAddressesWGSLOptions } from './webgpu/wgsl/rasterize-two-pass/mainTwoPassInitializeAddressesWGSL.js';
export { default as mainTwoPassCoarseWGSL, MAIN_TWO_PASS_COARSE_DEFAULTS } from './webgpu/wgsl/rasterize-two-pass/mainTwoPassCoarseWGSL.js';
export type { mainTwoPassCoarseWGSLOptions } from './webgpu/wgsl/rasterize-two-pass/mainTwoPassCoarseWGSL.js';
export { default as mainTwoPassFineWGSL, MAIN_TWO_PASS_FINE_DEFAULTS } from './webgpu/wgsl/rasterize-two-pass/mainTwoPassFineWGSL.js';
export type { mainTwoPassFineWGSLOptions } from './webgpu/wgsl/rasterize-two-pass/mainTwoPassFineWGSL.js';

// rasterize-two-pass modules
export { default as MainTwoPassFineModule, MAIN_TWO_PASS_FINE_MODULE_DEFAULTS } from './webgpu/modules/rasterize-two-pass/MainTwoPassFineModule.js';
export type { MainTwoPassFineModuleOptions } from './webgpu/modules/rasterize-two-pass/MainTwoPassFineModule.js';
export { default as MainTwoPassCoarseModule, MAIN_TWO_PASS_COARSE_MODULE_DEFAULTS } from './webgpu/modules/rasterize-two-pass/MainTwoPassCoarseModule.js';
export type { MainTwoPassCoarseModuleOptions } from './webgpu/modules/rasterize-two-pass/MainTwoPassCoarseModule.js';
export { default as MainTwoPassInitializeAddressesModule, MAIN_TWO_PASS_INITIALIZE_ADDRESSES_MODULE_DEFAULTS } from './webgpu/modules/rasterize-two-pass/MainTwoPassInitializeAddressesModule.js';
export type { MainTwoPassInitializeAddressesModuleOptions } from './webgpu/modules/rasterize-two-pass/MainTwoPassInitializeAddressesModule.js';
export { default as TwoPassModule, TWO_PASS_MODULE_DEFAULTS } from './webgpu/modules/rasterize-two-pass/TwoPassModule.js';
export type { TwoPassModuleOptions, TwoPassRunSize } from './webgpu/modules/rasterize-two-pass/TwoPassModule.js';

// testing
export { evaluateTwoPassFineSolo } from './webgpu/tests/rasterize-two-pass/TwoPassFineSolo.js';

export { default as TestRenderProgram } from './webgpu/TestRenderProgram.js';
export { default as PerformanceTesting } from './webgpu/PerformanceTesting.js';
export { default as GPUProfiling } from './webgpu/GPUProfiling.js';
export { default as RasterClipper } from './webgpu/old/RasterClipper.js';
export type { RasterClipperOptions } from './webgpu/old/RasterClipper.js';

export { shaderTestDevicePromise, asyncTestWithDevice, asyncTestWithDeviceContext, compareArrays } from './webgpu/tests/ShaderTestUtils.js';