// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, Resource } from '../../imports.js';

export default class BufferResource extends Resource {
  public constructor(
    public readonly buffer: GPUBuffer,
    public readonly offset = 0,
    public readonly size = 0
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
      // TODO: pass more sizes in!
      bufferBinding.size = this.size;
    }
    return {
      binding: binding.location.bindingIndex,
      resource: bufferBinding
    };
  }

  public toDebugString(): string {
    return `BufferResource[#${this.id}${this.buffer.label ? ` label:${this.buffer.label}` : ''} bufsize:${this.buffer.size}${this.offset !== 0 ? ` offset:${this.offset}` : ''}${this.size !== 0 ? ` size:${this.size}` : ''}]`;
  }
}
alpenglow.register( 'BufferResource', BufferResource );