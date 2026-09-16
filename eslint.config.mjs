import expo from 'eslint-config-expo/flat.js'
import prettier from 'eslint-config-prettier'
import reactNative from 'eslint-plugin-react-native'
import globals from 'globals'

// ESLint flat config, in layers.
//
//   1. `eslint-config-expo` — the React, React Hooks, import, and TypeScript
//      rules that match the Expo SDK. It registers `@typescript-eslint` and the
//      TS parser itself, so neither is a direct dependency here.
//   2. The two rules the RootNative repositories enforce and the Expo config
//      does not. `rootnative.github.io` starts from Expo's config and adds the
//      same delta; `ui`, `inertia` and `impulse` hand-build a config from
//      `typescript-eslint` and reach the same two rules. This app follows the
//      landing site, because both are Expo Router apps on yarn.
//   3. This repository's own rules, which no other repository has: the Node
//      globals for its CommonJS config files, the Jest globals, and the
//      credential guard.
//   4. `eslint-config-prettier`, last, to turn off anything that fights
//      `.prettierrc`.
export default [
  ...expo,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-native': reactNative },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'react-native/no-inline-styles': 'error',
    },
  },

  {
    // The test files are exempt from `no-inline-styles`. A style written inline
    // in a test is the fixture under assertion, and extracting it to a
    // `StyleSheet` would hide the value the test is about.
    files: ['**/*.test.ts', '**/*.test.tsx', 'lib/test-utils.tsx'],
    rules: {
      'react-native/no-inline-styles': 'off',
    },
  },

  {
    // The build scripts and the CommonJS config files run in Node, not in the
    // app runtime, so they need the Node globals. The Expo config supplies the
    // React Native ones only, which leaves `__dirname` and `require` undefined
    // here. This file is no longer in the list: it is ESM now.
    files: [
      'scripts/**/*.js',
      'app.config.js',
      'babel.config.js',
      'jest.config.js',
      'jest.setup.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    // Jest injects its globals rather than exporting them, so the linter needs
    // them declared. This replaces the `/* eslint-env jest */` comment form,
    // which ESLint 10 rejects.
    files: ['**/*.test.ts', '**/*.test.tsx', 'lib/test-utils.tsx'],
    languageOptions: {
      globals: globals.jest,
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

  prettier,

  {
    ignores: [
      'node_modules/',
      '.expo/',
      'dist/',
      'web-build/',
      'coverage/',
      '.jest-cache/',
      'expo-env.d.ts',
      // The proxy is server code and deploys on its own.
      'proxy/.vercel/',
    ],
  },
]
