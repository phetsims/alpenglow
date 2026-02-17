// Copyright 2024-2025, University of Colorado Boulder

/**
 * Raw type for a TwoPassConfig
 *
 * Notes about relationships for the various properties (how we align bins and tiles, index things, including pixels):
 *
 * raster-width, raster-height
 * tile-width, tile-height ---- ensure tile-x < tile-width and tile-y < tile-height!!!
 *   (tile index = tile-x + tile-y * tile-width)
 * num-tiles = tile-width * tile-height
 * bin-width, bin-height --- ensure bin-x < bin-width and bin-y < bin-height!!!
 *   (bin index = ( rel-bin-x + rel-bin-y * 16 ) + tile-index << 8?) - guarantee 256 bins per tile? BUT don't compute ones outside?
 * num-bins = 256 * num-tiles --- note not all will be used
 *
 * tile-size: 16 * bin-size
 * bin-size: usually subdivide-size (16), but could be 15 or 13 if bilinear/bicubic
 *
 * filter: box, bilinear, bicubic
 * adjust-filter-size: 1 or THE SCALE of the filter --- if non-1, we won't use the "grid filter" approach
 * filter-radius (how much we need to expand by)
 * [defer] tile/bin enabled mask (whether it should compute or write out)
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { PolygonFilterType } from '../../../render-program/PolygonFilterType.js';

export type TwoPassConfig = {
  rasterWidth: number;
  rasterHeight: number;
  tileWidth: number;
  tileHeight: number;
  binWidth: number;
  binHeight: number;
  tileSize: number;
  binSize: number;
  filter: PolygonFilterType;
  filterScale: number;
  rasterColorSpace: number; // 0: sRGB, 1: Display-P3
};