// Copyright 2024, University of Colorado Boulder

/**
 * ESLint configuration for alpenglow.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import phetLibraryEslintConfig from '../perennial-alias/js/eslint/phet-library.eslint.config.mjs';

export default [
  ...phetLibraryEslintConfig,
  {
    rules: {
      'no-bitwise': 'off',
      'phet/todo-should-have-issue': 'off'
    }
  }, {
    ignores: [ 'doc/lib/**/*' ]
  }
];