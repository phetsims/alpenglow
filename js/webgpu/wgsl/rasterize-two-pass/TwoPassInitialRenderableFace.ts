// Copyright 2024, University of Colorado Boulder

/**
 * Raw type for a TwoPassInitialRenderableFace
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
type TwoPassInitialRenderableFace = {
  // RenderProgram packed info
  renderProgramIndex: number;
  needsCentroid: boolean;
  needsFace: boolean;
  isConstant: boolean;
  isFullArea: boolean;

  edgesIndex: number;
  numEdges: number;
};

export default TwoPassInitialRenderableFace;