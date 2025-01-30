// Copyright 2023-2024, University of Colorado Boulder

/**
 * Stores information about what a RenderProgram needs in order to be evaluated
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../alpenglow.js';

export class RenderProgramNeeds {
  public constructor(
    public readonly needsFace: boolean,
    public readonly needsArea: boolean,
    public readonly needsCentroid: boolean
  ) {}
}

alpenglow.register( 'RenderProgramNeeds', RenderProgramNeeds );