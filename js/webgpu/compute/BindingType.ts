// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';

export abstract class BindingType {

  protected abstract mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void;

  // null if they can't be combined
  public abstract combined( other: BindingType ): BindingType | null;

  public abstract toDebugString(): string;

  public getBindGroupLayoutEntry( index: number ): GPUBindGroupLayoutEntry {
    const entry: GPUBindGroupLayoutEntry = {
      binding: index,
      visibility: GPUShaderStage.COMPUTE
    };

    this.mutateBindGroupLayoutEntry( entry );

    return entry;
  }
}
alpenglow.register( 'BindingType', BindingType );