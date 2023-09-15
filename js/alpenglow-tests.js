// Copyright 2023, University of Colorado Boulder

/**
 * Unit tests for alpenglow. Please run once in phet brand and once in brand=phet-io to cover all functionality.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 */

window.assertions.enableAssertSlow();

import qunitStart from '../../chipper/js/sim-tests/qunitStart.js';
import './cag/ClippableFaceTests.js';
import './cag/PolygonalBooleanTests.js';

// Since our tests are loaded asynchronously, we must direct QUnit to begin the tests
qunitStart();