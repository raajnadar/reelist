// Both `@react-native/jest-preset` and `react-native-worklets` ship a Jest
// resolver, and Jest accepts only one. This file chains them.
//
// The worklets resolver exists because `react-native-worklets` has two builds
// of its native module: `NativeWorklets.native.ts` talks to the real TurboModule
// and throws in Jest, and `NativeWorklets.ts` is the inert stub that tests need.
// The resolver drops every `native` extension while it resolves inside that
// package, so the stub wins. Without it, `require('react-native-reanimated')`
// fails at import time and every test suite that touches an animation dies.
//
// The React Native resolver does the real lookup, so it runs last.
const rnResolver = require('@react-native/jest-preset/jest/resolver')
const workletsResolver = require('react-native-worklets/jest/resolver')

module.exports = (request, options) => {
  // `defaultResolver` is re-bound to Jest's own resolver at each step, so
  // neither wrapper calls back into this chain and loops.
  const resolveWithReactNative = (req, opts) =>
    rnResolver(req, { ...opts, defaultResolver: options.defaultResolver })

  return workletsResolver(request, {
    ...options,
    defaultResolver: resolveWithReactNative,
  })
}
