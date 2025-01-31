// Copyright 2023-2025, University of Colorado Boulder

/**
 * Controls how polygons get filtered when output
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import { alpenglow } from '../alpenglow.js';

export enum PolygonFilterType {
  Box = 0,
  Bilinear = 1,
  MitchellNetravali = 2
}

export const getPolygonFilterWidth = ( filterType: PolygonFilterType ): number => {
  if ( filterType === PolygonFilterType.Box ) {
    return 1;
  }
  else if ( filterType === PolygonFilterType.Bilinear ) {
    return 2;
  }
  else if ( filterType === PolygonFilterType.MitchellNetravali ) {
    return 4;
  }
  else {
    throw new Error( `Unknown PolygonFilterType: ${filterType}` );
  }
};

export const getPolygonFilterExtraPixels = ( filterType: PolygonFilterType ): number => {
  if ( filterType === PolygonFilterType.Box ) {
    return 0;
  }
  else if ( filterType === PolygonFilterType.Bilinear ) {
    return 1;
  }
  else if ( filterType === PolygonFilterType.MitchellNetravali ) {
    return 3;
  }
  else {
    throw new Error( `Unknown PolygonFilterType: ${filterType}` );
  }
};

export const getPolygonFilterGridOffset = ( filterType: PolygonFilterType ): number => {
  if ( filterType === PolygonFilterType.Box ) {
    return 0;
  }
  else if ( filterType === PolygonFilterType.Bilinear ) {
    return -0.5;
  }
  else if ( filterType === PolygonFilterType.MitchellNetravali ) {
    return -1.5;
  }
  else {
    throw new Error( `Unknown PolygonFilterType: ${filterType}` );
  }
};

export const getPolygonFilterMinExpand = ( filterType: PolygonFilterType ): number => {
  if ( filterType === PolygonFilterType.Box ) {
    return 0;
  }
  else if ( filterType === PolygonFilterType.Bilinear ) {
    return 1;
  }
  else if ( filterType === PolygonFilterType.MitchellNetravali ) {
    return 2;
  }
  else {
    throw new Error( `Unknown PolygonFilterType: ${filterType}` );
  }
};

export const getPolygonFilterMaxExpand = ( filterType: PolygonFilterType ): number => {
  if ( filterType === PolygonFilterType.Box ) {
    return 1;
  }
  else if ( filterType === PolygonFilterType.Bilinear ) {
    return 1;
  }
  else if ( filterType === PolygonFilterType.MitchellNetravali ) {
    return 2;
  }
  else {
    throw new Error( `Unknown PolygonFilterType: ${filterType}` );
  }
};

export const getPolygonFilterGridBounds = ( bounds: Bounds2, filterType: PolygonFilterType, filterMultiplier = 1 ): Bounds2 => {

  const filterWidth = getPolygonFilterWidth( filterType ) * filterMultiplier;
  const filterExtension = 0.5 * ( filterWidth - 1 );

  if ( assert && filterMultiplier === 1 ) {
    const filterAdditionalPixels = getPolygonFilterExtraPixels( filterType );
    const filterGridOffset = getPolygonFilterGridOffset( filterType );

    assert && assert( filterGridOffset === -filterExtension );
    assert && assert( filterGridOffset + filterAdditionalPixels === filterExtension );
  }

  return bounds.dilated( filterExtension );
};

alpenglow.register( 'PolygonFilterType', PolygonFilterType );