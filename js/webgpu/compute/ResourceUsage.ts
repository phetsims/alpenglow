// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, ResourceSlot } from '../../imports.js';

export default abstract class ResourceUsage {
  public constructor(
    public readonly resourceSlot: ResourceSlot,
    public readonly bindingType: BindingType
  ) {}
}
alpenglow.register( 'ResourceUsage', ResourceUsage );
