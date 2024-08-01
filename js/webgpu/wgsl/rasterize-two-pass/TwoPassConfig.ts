// Copyright 2024, University of Colorado Boulder

import { PolygonFilterType } from '../../../imports.js';

/**
 * Raw type for a TwoPassConfig
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
type TwoPassConfig = {
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

export default TwoPassConfig;