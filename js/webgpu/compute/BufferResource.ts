// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, Resource } from '../../imports.js';

export default class BufferResource extends Resource {
  public constructor(
    public readonly buffer: GPUBuffer,
    public readonly offset = 0, // TODO: remove offset, since our BufferSlotSlices should handle it
    public readonly size = 0 // TODO: remove size, since our buffer already has a size
  ) {
    super( buffer );
  }

  public getBindGroupEntry( binding: Binding ): GPUBindGroupEntry {
    const bufferBinding: GPUBufferBinding = {
      buffer: this.buffer
    };
    if ( this.offset !== 0 ) {
      bufferBinding.offset = this.offset;
    }
    if ( this.size !== 0 ) {
      bufferBinding.size = this.size;
    }
    return {
      binding: binding.location.bindingIndex,
      resource: bufferBinding
    };
  }
}
alpenglow.register( 'BufferResource', BufferResource );
