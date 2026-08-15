// ESLint flat config. `eslint-config-expo` brings the React, React Hooks,
// import, and TypeScript rules that match the Expo SDK.
//
// `eslint-config-prettier` must stay last: it turns off the stylistic rules
// that would fight Prettier. Formatting is Prettier's job, not the linter's.
const expo = require('eslint-config-expo/flat')
const prettier = require('eslint-config-prettier')

module.exports = [
  ...expo,
  prettier,
  {
    // The build scripts run in Node, not in the app runtime, so they need the
    // Node globals. The Expo config supplies the React Native ones only, which
    // leaves `__dirname` and `require` undefined here.
    files: [
      'scripts/**/*.js',
      'eslint.config.js',
      'app.config.js',
      'babel.config.js',
      'jest.config.js',
      'jest.setup.js',
    ],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
      },
    },
  },
  {
    // Jest injects its globals rather than exporting them, so the linter needs
    // them declared. This replaces the `/* eslint-env jest */` comment form,
    // which ESLint 10 rejects.
    files: ['**/*.test.ts', '**/*.test.tsx', 'lib/test-utils.tsx'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/',
      '.expo/',
      'dist/',
      'web-build/',
      'coverage/',
      'expo-env.d.ts',
    ],
  },
]
