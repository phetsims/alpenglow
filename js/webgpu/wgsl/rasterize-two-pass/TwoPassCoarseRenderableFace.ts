// Copyright 2024, University of Colorado Boulder

/**
 * Raw type for a TwoPassCoarseRenderableFace
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
type TwoPassCoarseRenderableFace = {
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
  tileIndex: number;
};

export default TwoPassCoarseRenderableFace;