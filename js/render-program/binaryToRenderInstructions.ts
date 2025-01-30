// Copyright 2025, University of Colorado Boulder

/**
 * Reads the binary from from the encoder (at a specific dword offset), and returns the list of instructions.
 *
 * NOTE: No final "exit" is generated, since our executor for objects won't need it.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../alpenglow.js';
import { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import { binaryToRenderInstruction } from './binaryToRenderInstruction.js';

export const binaryToRenderInstructions = ( encoder: ByteEncoder, offset: number ): RenderInstruction[] => {

  // Compute the addresses of every instruction (based on its length), and read through all of the instructions
  // up through the exit.
  const instructionAddresses: number[] = [];
  let address = offset;
  while ( encoder.fullU32Array[ address ] !== RenderInstruction.ExitCode ) {
    instructionAddresses.push( address );
    address += RenderInstruction.getInstructionLength( encoder.fullU32Array[ address ] );
  }
  const exitAddress = address;

  // We'll lazy-load locations, since we (a) don't want to create them if they aren't needed, and (b) we only want
  // one for each "address" (so multiple instructions could potentially point to the same location).
  const locations: ( RenderInstructionLocation | null )[] = instructionAddresses.map( () => null );
  locations.push( null ); // Add the exit location

  // Given an instruction address, return its index on our list of non-location instructions
  const getIndexOfAddress = ( address: number ): number => {
    if ( address === exitAddress ) {
      return instructionAddresses.length;
    }
    const index = instructionAddresses.indexOf( address );
    assert && assert( index >= 0 );
    return index;
  };

  const getLocation = ( index: number ): RenderInstructionLocation => {
    if ( locations[ index ] === null ) {
      locations[ index ] = new RenderInstructionLocation();
    }
    return locations[ index ];
  };

  const getLocationOfAddress = ( address: number ): RenderInstructionLocation => {
    return getLocation( getIndexOfAddress( address ) );
  };

  // We'll need to merge together our location-instructions with non-location instructions. Since jumps are only
  // forward, we can just compute binary instructions in order.
  const instructions: RenderInstruction[] = [];
  for ( let i = 0; i < instructionAddresses.length; i++ ) {
    const address = instructionAddresses[ i ];
    const instruction = binaryToRenderInstruction( encoder, address, addressOffset => {
      return getLocationOfAddress( address + addressOffset );
    } );

    // Possible location instruction (takes up zero length) will go first
    const location = locations[ i ];
    if ( location ) {
      instructions.push( location );
    }
    instructions.push( instruction );
  }
  // Potential ending location instruction (e.g. if there is a jump to the exit at the end).
  const lastLocation = locations[ instructionAddresses.length ];
  if ( lastLocation ) {
    instructions.push( lastLocation );
  }

  return instructions;
};
alpenglow.register( 'binaryToRenderInstructions', binaryToRenderInstructions );