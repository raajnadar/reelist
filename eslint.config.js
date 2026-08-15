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
    files: ['scripts/**/*.js', 'eslint.config.js', 'app.config.js', 'babel.config.js'],
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
    ignores: ['node_modules/', '.expo/', 'dist/', 'web-build/', 'expo-env.d.ts'],
  },
]
