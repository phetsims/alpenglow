// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding } from '../../imports.js';

let globalId = 1;

export default abstract class Resource {
  public readonly id: number = globalId++;

  public constructor(
    public readonly resource: GPUBuffer | GPUTextureView
  ) {}

  // TODO: consider modifying to just BufferLocation or bindingIndex
  public abstract getBindGroupEntry( binding: Binding ): GPUBindGroupEntry;

  public abstract toDebugString(): string;
}
alpenglow.register( 'Resource', Resource );
