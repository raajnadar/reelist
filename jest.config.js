// `jest-expo` supplies the Expo SDK 57 preset: the React Native transform, the
// module mocks, and the platform-aware resolver. Do not replace it with a plain
// `babel-jest` setup — the app imports native modules that only this preset
// stubs.
// The proxy is server code, not app code. It uses the Web Request/Response API
// that Node supplies and the React Native preset does not, so it runs as its
// own project in a node environment. `yarn test` still runs both.
const proxyProject = {
  displayName: 'proxy',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/proxy/**/*.test.ts'],
  // babel-preset-expo is already a dependency and strips the types. The proxy
  // imports nothing from the app, so it needs no other transform.
  transform: {
    '^.+\\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
}

const appProject = {
  displayName: 'app',
  preset: 'jest-expo',

  // The preset ignores node_modules by default, but every React Native package
  // ships untranspiled ESM. These have to go through Babel or the run fails on
  // an `import` statement.
  // `@rootnative/*` and `@material/material-color-utilities` are ESM-only, and
  // the theme pulls in both. They are the two entries here that are not part of
  // the stock Expo list. `standard-navigation` is part of the stock list: it is
  // an ESM-only package that expo-router imports from its own entry point.
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|standard-navigation|@rootnative/.*|@material/material-color-utilities)',
    // The Reanimated Babel plugin is part of the transformer, so transforming it
    // makes Babel report a reentrant plugin. Same for the RN Babel preset. Both
    // entries come from the jest-expo preset, which the line above replaces.
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
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

  // See jest.resolver.js: react-native-worklets needs its stub native module
  // in Jest, and that only happens through a resolver.
  resolver: '<rootDir>/jest.resolver.js',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // `dist/` holds the exported web build, which contains a copy of the bundled
  // source. Without this, Jest finds those copies and runs each test twice.
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/.expo/',
    // The proxy is the other project's job.
    '<rootDir>/proxy/',
  ],
}

module.exports = {
  projects: [appProject, proxyProject],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'components/**/*.tsx',
    'app/**/*.tsx',
    'proxy/api/**/*.ts',
  ],
}
