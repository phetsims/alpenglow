// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding } from '../../imports.js';

export default abstract class Resource {
  public constructor(
    public readonly resource: GPUBuffer | GPUTextureView
  ) {}

  // TODO: consider modifying to just BufferLocation or bindingIndex
  public abstract getBindGroupEntry( binding: Binding ): GPUBindGroupEntry;
}
alpenglow.register( 'Resource', Resource );
