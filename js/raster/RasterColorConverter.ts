// Copyright 2023-2025, University of Colorado Boulder

/**
 * An interface that handles converting between essentially three "color spaces":
 * - client space (e.g. premultiplied sRGB)
 * - accumulation space (e.g. premultiplied linear sRGB)
 * - output space (e.g. sRGB255, so we can write to ImageData)
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector4 from '../../../dot/js/Vector4.js';

export type RasterColorConverter = {
  // NOTE: DO NOT STORE THE VALUES OF THESE RESULTS, THEY ARE MUTATED. Create a copy if needed
  clientToAccumulation( client: Vector4 ): Vector4;
  clientToOutput( client: Vector4 ): Vector4;
  accumulationToOutput( accumulation: Vector4 ): Vector4;
};