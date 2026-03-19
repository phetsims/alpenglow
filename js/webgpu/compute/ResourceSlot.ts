// Copyright 2023-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

let globalId = 1;

export abstract class ResourceSlot {
  public readonly id: number = globalId++;

  public abstract toDebugString(): string;
}
