# Reelist

Reelist is a React Native app. It is built with Expo, Expo Router, and
[RootNative UI](https://rootnative.github.io/ui/). The app runs on iOS, Android,
and the web.

## Try the app

### On a phone

Scan this code to open the app in Expo Go. You do not need this repository, and
you do not need a development server.

<img src="assets/docs/expo-go-qr.png" alt="QR code that opens Reelist in Expo Go" width="220" />

1. Install **Expo Go** from the App Store or Google Play.
2. Scan the code. Use the Expo Go app on Android, and the Camera app on iOS.
3. The app opens. The code always serves the newest commit on `main`.

If the code does not scan, open this link on the phone:

```
exp://u.expo.dev/7fe1b9fe-fa75-406c-aaf9-ae330957fc46?channel-name=main
```

The app runs on Expo Go SDK 54. Update Expo Go if it reports a version
mismatch.

### In a browser

The web build is at **https://raajnadar.github.io/reelist/**. It updates on
every push to `main`.

The browser build has no gestures and no native animation driver, so the
carousel feels different there. Use the phone build to judge the motion.

## Requirements

- Node.js 24 or later (see `.nvmrc`; run `nvm use`)
- Yarn
- The Expo Go app, an iOS simulator, or an Android emulator

## Start the app

1. Install the dependencies:

   ```bash
   yarn install
   ```

2. Point the app at a TMDB proxy.

   ```bash
   cp .env.example .env
   ```

   Open `.env` and set `EXPO_PUBLIC_TMDB_PROXY_URL`. Deploy the proxy first —
   see [proxy/README.md](proxy/README.md), which takes about five minutes.

   **The app holds no TMDB key, and it must stay that way.** Every
   `EXPO_PUBLIC_*` value is inlined into the JavaScript bundle at build time and
   can be read out of the web build, the `.apk`, and the `.ipa`. The proxy holds
   the key on the server. The proxy URL is public by design: it is an address,
   not a credential.

3. Start the development server:

   ```bash
   yarn start
   ```

4. Press `i` for iOS, `a` for Android, or `w` for the web.

Metro caches the value at build time. Run `yarn start --clear` after you change
`.env`, or the old one stays in the bundle.

## Scripts

| Script              | Function                                      |
| ------------------- | --------------------------------------------- |
| `yarn start`        | Starts the Expo development server.           |
| `yarn ios`          | Starts the app in the iOS simulator.          |
| `yarn android`      | Starts the app in the Android emulator.       |
| `yarn web`          | Starts the app in the browser.                |
| `yarn typecheck`    | Runs TypeScript. Emits no files.              |
| `yarn lint`         | Runs ESLint.                                  |
| `yarn lint:fix`     | Runs ESLint and applies the fixes it can.     |
| `yarn format`       | Applies Prettier to every file.               |
| `yarn format:check` | Reports the files that Prettier would change. |
| `yarn build:web`    | Exports the static web build to `dist/`.      |

CI runs `typecheck`, `lint`, and `format:check` on every push to `main` and on
every pull request.

## Project structure

```
app/
├── _layout.tsx       # Root layout with the ThemeProvider
└── index.tsx         # Home screen
components/           # MovieCarousel, MovieRow, MovieCard, CarouselCard
lib/
├── api.ts            # The only file a screen imports for data
├── tmdb.ts           # The HTTP transport for the TMDB API
├── config.ts         # Reads the TMDB key from the environment
├── types.ts          # Movie and Paged, in the TMDB field shape
├── mock.ts           # Static movie data, now used only as a test fixture
├── images.ts         # Builds a TMDB poster URL from a path fragment
└── format.ts         # Rating and year labels
assets/               # App icons, the splash screen, and the README QR code
theme.ts              # The Material 3 light and dark themes
app.json              # Expo configuration
app.config.js         # Adds `baseUrl` for the GitHub Pages build
eas.json              # EAS build and update profiles
package.json
tsconfig.json
CLAUDE.md             # Instructions for AI agents
```

Expo Router uses the files in `app/` to make the navigation. Each file is one
screen.

`lib/api.ts` is the single seam between the UI and the data. Every screen
imports from it and from nowhere else.

The seam proved itself. The functions were written `async` against static mock
data first, so the screens already handled latency and failure. The move to the
real TMDB API changed `lib/api.ts` and added `lib/tmdb.ts` under it. It changed
no screen.

Three files sit behind the seam:

| File            | Function                                                            |
| --------------- | ------------------------------------------------------------------- |
| `lib/api.ts`    | The seam. Maps a TMDB response to the `Movie` type.                 |
| `lib/tmdb.ts`   | The transport. Builds the URL and turns a bad status into an error. |
| `lib/config.ts` | Reads the key. Throws `MissingKeyError` when it is absent.          |

A missing key is a distinct error from a failed request, so the app prints the
setup instruction instead of "Could not load movies".

## Technology

- Expo SDK 54 and Expo Router 6
- React Native 0.81 and React 19
- `@rootnative/core` — the theme system with Material Design 3 tokens
- `@rootnative/components` — the UI components
- TypeScript

## Deployment

Two workflows publish the app on every push to `main`.

| Workflow                                             | Publishes             | Target                                  |
| ---------------------------------------------------- | --------------------- | --------------------------------------- |
| [`deploy.yml`](.github/workflows/deploy.yml)         | The static web build  | GitHub Pages                            |
| [`eas-update.yml`](.github/workflows/eas-update.yml) | The JavaScript bundle | The EAS `main` channel, for the QR code |

The QR image never changes. It points at the channel, and the workflow moves the
channel to the newest bundle.

To publish an update by hand:

```bash
npx eas update --branch main --message "What changed"
```

### Setup that this repository cannot do for itself

Four steps need the GitHub or Expo web interface:

1. **Turn on Pages.** In `Settings → Pages`, set **Source** to **GitHub
   Actions**. The deploy workflow fails until this is set.
2. **Add the `EXPO_TOKEN` secret.** Make a token at
   [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens),
   then add it in `Settings → Secrets and variables → Actions`. The EAS workflow
   skips its steps without it.
3. **Add the `EXPO_PUBLIC_TMDB_API_KEY` secret.** Both deploy workflows read it
   in `Settings → Secrets and variables → Actions`. The key is inlined into the
   bundle at build time, so without it the published app builds and then shows
   the setup error on every row.
4. **Require the CI check.** In `Settings → Branches`, add a rule for `main` and
   mark the `check` job as required. Until then CI reports a failure but does
   not stop a merge.

## More information

- [RootNative UI documentation](https://rootnative.github.io/ui)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
- [Expo documentation](https://docs.expo.dev/)
