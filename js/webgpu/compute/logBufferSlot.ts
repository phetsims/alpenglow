// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BufferSlot } from './BufferSlot.js';
import { getArrayType, getCastedType, U32Type } from './ConcreteType.js';
import { wgsl, WGSLModule, wgslWith } from '../wgsl/WGSLString.js';

// TODO: oh no, we need to put the atomic in here(!)
// TODO: Or actually, just an ability to put structs of arbitrary types in ConcreteTypes
export const logBufferSlot = new BufferSlot( getCastedType( getArrayType( U32Type, 2 << 24, 0 ), wgslWith(
  wgsl`_Log`,
  new WGSLModule( '_Log', wgsl`
    struct _Log {
      next_space: atomic<u32>,
      data: array<u32>
    };
  ` )
) ) );