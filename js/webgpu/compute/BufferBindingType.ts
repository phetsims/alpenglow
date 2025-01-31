// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import { BindingType } from './BindingType.js';

export class BufferBindingType extends BindingType {
  public constructor(
    public readonly type: GPUBufferBindingType
    // public readonly hasDynamicOffset: boolean = false,
    // public readonly minBindingSize = 0
  ) {
    super();
  }

  public combined( other: BindingType ): BindingType | null {
    if ( other instanceof BufferBindingType ) {
      if ( this.type === other.type ) {
        return this;
      }
      else if ( this.type !== 'uniform' && other.type !== 'uniform' ) {
        // e.g. read-write and write
        return BufferBindingType.STORAGE;
      }
      else {
        return null;
      }
    }
    else {
      return null;
    }
  }

  public toDebugString(): string {
    return `BufferBindingType[${this.type}]`;
    // return `BufferBindingType(${this.type}, ${this.hasDynamicOffset}, ${this.minBindingSize})`;
  }

  protected override mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void {
    entry.buffer = {
      type: this.type
      // hasDynamicOffset: this.hasDynamicOffset,
      // minBindingSize: this.minBindingSize // TODO: see if we get better performance by skipping validation?
    };
  }

  public static readonly UNIFORM = new BufferBindingType( 'uniform' );
  public static readonly READ_ONLY_STORAGE = new BufferBindingType( 'read-only-storage' );
  public static readonly STORAGE = new BufferBindingType( 'storage' );
}
alpenglow.register( 'BufferBindingType', BufferBindingType );