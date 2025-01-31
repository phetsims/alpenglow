// Copyright 2023-2025, University of Colorado Boulder

/**
 * Interface for an output raster
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import type { RasterColorConverter } from './RasterColorConverter.js';

export type OutputRaster = {
  // NOTE: These functions should not store a reference to the color
  addClientPartialPixel( color: Vector4, x: number, y: number ): void;
  addClientFullPixel( color: Vector4, x: number, y: number ): void;
  addOutputFullPixel( color: Vector4, x: number, y: number ): void;
  addClientFullRegion( color: Vector4, x: number, y: number, width: number, height: number ): void;
  addOutputFullRegion( color: Vector4, x: number, y: number, width: number, height: number ): void;
  colorConverter: RasterColorConverter;
};