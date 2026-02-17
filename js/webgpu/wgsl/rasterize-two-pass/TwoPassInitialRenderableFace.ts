// Copyright 2024-2025, University of Colorado Boulder

/**
 * Raw type for a TwoPassInitialRenderableFace
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */
export type TwoPassInitialRenderableFace = {
  // RenderProgram packed info
  renderProgramIndex: number;
  needsCentroid: boolean;
  needsFace: boolean;
  isConstant: boolean;
  isFullArea: boolean;

  edgesIndex: number;
  numEdges: number;
};