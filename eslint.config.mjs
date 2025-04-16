// Copyright 2024, University of Colorado Boulder

/**
 * ESLint configuration for alpenglow.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import phetLibraryEslintConfig from '../perennial-alias/js/eslint/config/phet-library.eslint.config.mjs';
import { webGPUEslintGlobals } from './js/webgpu/webGPUEslintGlobals.mjs';

export default [
  ...phetLibraryEslintConfig,
  {
    rules: {
      'no-bitwise': 'off',
      'phet/todo-should-have-issue': 'off',
      'phet/documentation-before-imports': 'off'
    },
    languageOptions: {
      globals: {
        ...webGPUEslintGlobals
      }
    }
  },
  {
    ignores: [
      '!doc/',
      'doc/lib/**/*'
    ]
  }
];