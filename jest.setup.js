// Reanimated ships its own Jest mock. Without it, any component that calls a
// Reanimated hook throws, which is every card in this app.
require('react-native-reanimated').setUpTests()

// lib/resourceCache.ts lives for the life of the process, and a Jest module
// registry is shared by every test in a file. Without this, the second render
// of a screen in one file reads the first render's answer and never calls the
// mocked API, so the test asserts against data no mock supplied.
const { clearCache } = require('./lib/resourceCache')

beforeEach(() => {
  clearCache()
})
