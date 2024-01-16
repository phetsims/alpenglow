// Copyright 2023-2024, University of Colorado Boulder

/**
 * Unit tests for alpenglow. Please run once in phet brand and once in brand=phet-io to cover all functionality.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 */

window.assertions.enableAssertSlow();

import qunitStart from '../../chipper/js/sim-tests/qunitStart.js';
import './webgpu/tests/gpu/ReduceModuleTests.js';
import './webgpu/tests/gpu/ScanModuleTests.js';
import './webgpu/tests/gpu/RadixSortModuleTests.js';
import './webgpu/tests/gpu/MergeSimpleModuleTests.js';
import './webgpu/tests/gpu/MergeModuleTests.js';
import './webgpu/tests/gpu/HistogramModuleTests.js';
import './cag/ClippableFaceTests.js';
import './cag/PolygonalBooleanTests.js';
import './clip/PolygonClippingTests.js';
import './parallel/ParallelTests.js';
import './raster/RasterizeTests.js';
import './webgpu/old/OldSnippetTests.js';
import './render-program/RenderProgramTests.js';
import './webgpu/RenderProgramWebGPUTests.js';

// Since our tests are loaded asynchronously, we must direct QUnit to begin the tests
qunitStart();