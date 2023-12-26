// Copyright 2023, University of Colorado Boulder

/**
 * Represents a binding type (for generating bind group entries/layoutEntries).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

export default class OldBindingType {

  private constructor(
    private readonly mutateBindGroupLayoutEntry: ( entry: GPUBindGroupLayoutEntry ) => void
  ) {}

  public getBindGroupLayoutEntry( index: number ): GPUBindGroupLayoutEntry {
    const entry: GPUBindGroupLayoutEntry = {
      binding: index,
      visibility: GPUShaderStage.COMPUTE
    };
    this.mutateBindGroupLayoutEntry( entry );
    return entry;
  }

  public getBindGroupEntry( index: number, resource: GPUBuffer | GPUTextureView ): GPUBindGroupEntry {
    return {
      binding: index,
      // handle GPUTextureView
      resource: resource instanceof GPUBuffer ? { buffer: resource } : resource
    };
  }

  public static readonly STORAGE_BUFFER = new OldBindingType( entry => {
    entry.buffer = {
      type: 'storage',
      hasDynamicOffset: false
    };
  } );

  public static readonly READ_ONLY_STORAGE_BUFFER = new OldBindingType( entry => {
    entry.buffer = {
      type: 'read-only-storage',
      hasDynamicOffset: false
    };
  } );

  public static readonly UNIFORM_BUFFER = new OldBindingType( entry => {
    entry.buffer = {
      type: 'uniform',
      hasDynamicOffset: false
    };
  } );

  public static readonly TEXTURE_OUTPUT_RGBA8UNORM = new OldBindingType( entry => {
    entry.storageTexture = {
      access: 'write-only',
      format: 'rgba8unorm',
      viewDimension: '2d'
    };
  } );

  public static readonly TEXTURE_OUTPUT_BGRA8UNORM = new OldBindingType( entry => {
    entry.storageTexture = {
      access: 'write-only',
      format: 'bgra8unorm',
      viewDimension: '2d'
    };
  } );

  public static readonly TEXTURE_INPUT = new OldBindingType( entry => {
    entry.texture = {
      sampleType: 'float',
      viewDimension: '2d',
      multisampled: false
    };
  } );
}

alpenglow.register( 'OldBindingType', OldBindingType );
