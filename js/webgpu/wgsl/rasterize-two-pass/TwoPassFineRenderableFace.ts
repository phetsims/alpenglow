// Copyright 2024, University of Colorado Boulder

/**
 * Raw type for a TwoPassFineRenderableFace
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
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