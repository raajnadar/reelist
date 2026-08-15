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
    // A key read through EXPO_PUBLIC_ is inlined into the bundle as a literal
    // and can be read out of the web build, the .apk, and the .ipa. The proxy
    // in proxy/ exists so the app never holds one. This rule fails the build if
    // someone reintroduces the pattern, because the mistake is invisible
    // otherwise: the app works, and the key leaks.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'] > Identifier[name=/KEY|SECRET|TOKEN|PASSWORD/i]",
          message:
            'Never read a key or a token in app code. EXPO_PUBLIC_* is inlined into the bundle and can be extracted from the web build, the .apk, and the .ipa. Put the credential behind the proxy in proxy/ instead.',
        },
      ],
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
      // The proxy is server code and deploys on its own.
      'proxy/.vercel/',
    ],
  },
]
