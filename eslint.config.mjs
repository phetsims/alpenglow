// Copyright 2024, University of Colorado Boulder

/**
 * ESlint configuration for alpenglow.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import phetLibraryEslintConfig from '../chipper/eslint/phet-library.eslint.config.mjs';

export default [
  ...phetLibraryEslintConfig,
  {
    ignores: [ 'doc/lib/**/*' ],
    rules: {
      'no-bitwise': 'off',
      'phet/todo-should-have-issue': 'off'
    }
  }
];