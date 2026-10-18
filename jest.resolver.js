// Both `@react-native/jest-preset` and `react-native-reanimated` ship a Jest
// resolver, and Jest accepts only one. This file chains them.
//
// The Reanimated resolver wraps the `react-native-worklets` resolver. Both
// packages have native files that talk to the real TurboModule and throw in
// Jest, next to inert files that tests need. Each resolver drops the `native`
// extension for those files, so the inert file wins. Without the Reanimated
// half, its native initializer calls `runOnUISync`, which throws in Jest, so
// `require('react-native-reanimated')` fails and every animated suite dies.
//
// The React Native resolver does the real lookup, so it runs last.
const rnResolver = require('@react-native/jest-preset/jest/resolver')
const reanimatedResolver = require('react-native-reanimated/jest/resolver')

module.exports = (request, options) => {
  // `defaultResolver` is re-bound to Jest's own resolver at each step, so
  // neither wrapper calls back into this chain and loops.
  const resolveWithReactNative = (req, opts) =>
    rnResolver(req, { ...opts, defaultResolver: options.defaultResolver })

  return reanimatedResolver(request, {
    ...options,
    defaultResolver: resolveWithReactNative,
  })
}
