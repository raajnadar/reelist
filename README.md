# Reelist

Reelist is a React Native app. It is built with Expo, Expo Router, and
[RootNative UI](https://rootnative.github.io/ui/). The app runs on iOS, Android,
and the web.

## Requirements

- Node.js 20 or later
- Yarn
- The Expo Go app, an iOS simulator, or an Android emulator

## Start the app

1. Install the dependencies:

   ```bash
   yarn install
   ```

2. Start the development server:

   ```bash
   yarn start
   ```

3. Press `i` for iOS, `a` for Android, or `w` for the web.

## Scripts

| Script         | Function                                |
| -------------- | --------------------------------------- |
| `yarn start`   | Starts the Expo development server.     |
| `yarn ios`     | Starts the app in the iOS simulator.    |
| `yarn android` | Starts the app in the Android emulator. |
| `yarn web`     | Starts the app in the browser.          |

## Project structure

```
app/
├── _layout.tsx       # Root layout with the ThemeProvider
└── index.tsx         # Home screen
assets/               # App icons and the splash screen
app.json              # Expo configuration
babel.config.js
package.json
tsconfig.json
CLAUDE.md             # Instructions for AI agents
```

Expo Router uses the files in `app/` to make the navigation. Each file is one
screen.

## Technology

- Expo SDK 54 and Expo Router 6
- React Native 0.81 and React 19
- `@rootnative/core` — the theme system with Material Design 3 tokens
- `@rootnative/components` — the UI components
- TypeScript

## More information

- [RootNative UI documentation](https://rootnative.github.io/ui)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
- [Expo documentation](https://docs.expo.dev/)
