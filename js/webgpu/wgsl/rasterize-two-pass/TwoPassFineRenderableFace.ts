// Copyright 2024-2025, University of Colorado Boulder

/**
 * Raw type for a TwoPassFineRenderableFace
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */
export type TwoPassFineRenderableFace = {
  // RenderProgram packed info
  renderProgramIndex: number;
  needsCentroid: boolean;
  needsFace: boolean;
  isConstant: boolean;
  isFullArea: boolean;

  edgesIndex: number;
  numEdges: number;
  minXCount: number;
  minYCount: number;
  maxXCount: number;
  maxYCount: number;
  nextAddress: number;
};