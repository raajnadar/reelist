// `jest-expo` supplies the Expo SDK 54 preset: the React Native transform, the
// module mocks, and the platform-aware resolver. Do not replace it with a plain
// `babel-jest` setup — the app imports native modules that only this preset
// stubs.
module.exports = {
  preset: 'jest-expo',

  // The preset ignores node_modules by default, but every React Native package
  // ships untranspiled ESM. These have to go through Babel or the run fails on
  // an `import` statement.
  // `@rootnative/*` and `@material/material-color-utilities` are ESM-only, and
  // the theme pulls in both. They are the two entries here that are not part of
  // the stock Expo list.
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@rootnative/.*|@material/material-color-utilities)',
  ],

  // `@rootnative/*` ships ESM only — the package `main` is an `.mjs` file with
  // no CommonJS build. Jest's default transform matches .js/.jsx/.ts/.tsx only,
  // so without these two entries the .mjs is loaded raw and the run dies on its
  // first `import`. `transformIgnorePatterns` alone does not help: a file that
  // no transform matches is never transformed, allowed or not.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json', 'node'],
  transform: {
    '^.+\\.mjs$': 'babel-jest',
  },

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // `dist/` holds the exported web build, which contains a copy of the bundled
  // source. Without this, Jest finds those copies and runs each test twice.
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/.expo/',
  ],

  collectCoverageFrom: ['lib/**/*.ts', 'components/**/*.tsx', 'app/**/*.tsx'],
}
