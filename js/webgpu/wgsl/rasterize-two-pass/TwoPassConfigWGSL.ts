// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * Uniforms for a TwoPassConfig
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default new WGSLReferenceModule( 'TwoPassConfig', wgsl`
  struct TwoPassConfig {
    raster_width: u32,
    raster_height: u32,
    tile_width: u32,
    tile_height: u32,
    bin_width: u32,
    bin_height: u32,
    tile_size: u32,
    bin_size: u32,
    filter_type: u32,
    filter_scale: f32,
    raster_color_space: u32
  }
` );