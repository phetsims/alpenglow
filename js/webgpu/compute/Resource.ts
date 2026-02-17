// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';
import type { Binding } from './Binding.js';

let globalId = 1;

export abstract class Resource {
  public readonly id: number = globalId++;

  public constructor(
    public readonly resource: GPUBuffer | GPUTextureView
  ) {}

  // TODO: consider modifying to just BufferLocation or bindingIndex
  public abstract getBindGroupEntry( binding: Binding ): GPUBindGroupEntry;

  public abstract toDebugString(): string;
}
alpenglow.register( 'Resource', Resource );