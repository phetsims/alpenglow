// Copyright 2023-2026, University of Colorado Boulder

/**
 * Some utility functions for parallel kernels
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector3 from '../../../dot/js/Vector3.js';
import { alpenglow } from '../alpenglow.js';

export class ParallelUtils {

  // Convert to an exclusive scan with the different indices
  public static getInclusiveToExclusiveScanIndices( index: number, workgroupSize: number ): Vector3 {
    const index0 = Math.floor( index / workgroupSize );
    const index1 = Math.floor( index0 / workgroupSize );
    const index2 = Math.floor( index1 / workgroupSize );

    return new Vector3( index0 - 1, index1 - 1, index2 - 1 );
  }
}

alpenglow.register( 'ParallelUtils', ParallelUtils );