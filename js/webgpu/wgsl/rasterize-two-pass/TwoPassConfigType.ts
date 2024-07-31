// Copyright 2024, University of Colorado Boulder

import { ByteEncoder, ConcreteType, StoreStatementCallback, TwoPassConfig, TwoPassConfigWGSL, wgsl, WGSLExpression, WGSLStatements } from '../../../imports.js';

/**
 * ConcreteType for a TwoPassConfig
 *
 * TODO auto create?
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const dwords = 11;

const TwoPassConfigType: ConcreteType<TwoPassConfig> = {
  name: 'TwoPassConfig',
  bytesPerElement: dwords * 4,

  // TODO: do we need to implement these?
  equals: () => false,
  equalsWGSL: () => wgsl`false`,

  encode( value: TwoPassConfig, encoder: ByteEncoder ): void {
    encoder.pushU32( value.rasterWidth );
    encoder.pushU32( value.rasterHeight );
    encoder.pushU32( value.tileWidth );
    encoder.pushU32( value.tileHeight );
    encoder.pushU32( value.binWidth );
    encoder.pushU32( value.binHeight );
    encoder.pushU32( value.tileSize );
    encoder.pushU32( value.binSize );
    encoder.pushU32( value.filter );
    encoder.pushF32( value.filterScale );
    encoder.pushF32( value.rasterColorSpace );
  },
  decode( encoder: ByteEncoder, offset: number ): TwoPassConfig {
    return {
      rasterWidth: encoder.fullU32Array[ offset + 0 ],
      rasterHeight: encoder.fullU32Array[ offset + 1 ],
      tileWidth: encoder.fullU32Array[ offset + 2 ],
      tileHeight: encoder.fullU32Array[ offset + 3 ],
      binWidth: encoder.fullU32Array[ offset + 4 ],
      binHeight: encoder.fullU32Array[ offset + 5 ],
      tileSize: encoder.fullU32Array[ offset + 6 ],
      binSize: encoder.fullU32Array[ offset + 7 ],
      filter: encoder.fullU32Array[ offset + 8 ],
      filterScale: encoder.fullF32Array[ offset + 9 ],
      rasterColorSpace: encoder.fullF32Array[ offset + 10 ]
    };
  },
  valueType: TwoPassConfigWGSL,
  writeU32s( storeStatement: StoreStatementCallback, value: WGSLExpression ): WGSLStatements {
    return wgsl`
       ${storeStatement( wgsl`0u`, wgsl`${value}.raster_width` )}
       ${storeStatement( wgsl`1u`, wgsl`${value}.raster_height` )}
       ${storeStatement( wgsl`2u`, wgsl`${value}.tile_width` )}
       ${storeStatement( wgsl`3u`, wgsl`${value}.tile_height` )}
       ${storeStatement( wgsl`4u`, wgsl`${value}.bin_width` )}
       ${storeStatement( wgsl`5u`, wgsl`${value}.bin_height` )}
       ${storeStatement( wgsl`6u`, wgsl`${value}.tile_size` )}
       ${storeStatement( wgsl`7u`, wgsl`${value}.bin_size` )}
       ${storeStatement( wgsl`8u`, wgsl`${value}.filter` )}
       ${storeStatement( wgsl`9u`, wgsl`bitcast<u32>( ${value}.filter_scale )` )}
       ${storeStatement( wgsl`10u`, wgsl`${value}.raster_color_space` )}
    `;
  },
  wgslAlign: 4 * Math.ceil( dwords / 4 ) * 4, // possibly wrong?
  wgslSize: 4 * dwords,

  generateRandom: ( fullSize = false ) => {
    throw new Error( 'unimplemented' );
  },

  toDebugString: ( value: TwoPassConfig ) => 'TwoPassConfig'
};
export default TwoPassConfigType;