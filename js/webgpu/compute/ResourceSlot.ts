// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

export default abstract class ResourceSlot {
  public abstract toString(): string;
}
alpenglow.register( 'ResourceSlot', ResourceSlot );
