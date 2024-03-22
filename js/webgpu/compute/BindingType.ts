// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

export default abstract class BindingType {

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