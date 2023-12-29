// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

let globalId = 1;

export default abstract class ResourceSlot {
  public readonly id: number = globalId++;

  public abstract toDebugString(): string;
}
alpenglow.register( 'ResourceSlot', ResourceSlot );
