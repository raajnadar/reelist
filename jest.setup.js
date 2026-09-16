// Reanimated ships its own Jest mock. Without it, any component that calls a
// Reanimated hook throws, which is every card in this app.
require('react-native-reanimated').setUpTests()

// AsyncStorage is a native module, so it does not exist in Jest. The package
// ships this mock, which keeps the values in memory for the life of the file.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// Both stores live for the life of the process, and a Jest module registry is
// shared by every test in a file. Without this, the second render of a screen
// in one file reads the first render's answer and never calls the mocked API,
// and a film saved by one test is still saved in the next.
const { clearCache } = require('./lib/resourceCache')
const { resetWatchlist } = require('./lib/watchlist')
const AsyncStorage = require('@react-native-async-storage/async-storage')

beforeEach(async () => {
  clearCache()
  resetWatchlist()
  // The mock keeps its own values as well, so the store and the device copy
  // have to be emptied together.
  await AsyncStorage.clear()
})
