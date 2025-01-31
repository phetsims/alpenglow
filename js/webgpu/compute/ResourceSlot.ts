// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';

let globalId = 1;

export abstract class ResourceSlot {
  public readonly id: number = globalId++;

  public abstract toDebugString(): string;
}
alpenglow.register( 'ResourceSlot', ResourceSlot );