// Reanimated ships its own Jest mock. Without it, any component that calls a
// Reanimated hook throws, which is every card in this app.
require('react-native-reanimated').setUpTests()
