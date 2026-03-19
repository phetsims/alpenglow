// Copyright 2023-2026, University of Colorado Boulder

/**
 * Stores information about what a RenderProgram needs in order to be evaluated
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

export class RenderProgramNeeds {
  public constructor(
    public readonly needsFace: boolean,
    public readonly needsArea: boolean,
    public readonly needsCentroid: boolean
  ) {}
}
