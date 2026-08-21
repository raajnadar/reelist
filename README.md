# Reelist

Reelist is a React Native app that browses films from
[TMDB](https://www.themoviedb.org/). It is built with Expo, Expo Router, and
[RootNative UI](https://rootnative.github.io/ui/). The app runs on iOS, Android,
and the web.

The app holds no API key. It reads its data through a small proxy that keeps the
key on a server. [Why that matters](#the-key-never-reaches-the-app) is explained
below, because it shapes the whole data layer.

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

The app runs on Expo Go SDK 54. Update Expo Go if it reports a version mismatch.

### In a browser

The web build is at **https://raajnadar.github.io/reelist/**. It updates on every
push to `main`.

The browser build has no gestures and no native animation driver, so the carousel
feels different there. Use the phone build to judge the motion.

## Requirements

- Node.js 24 or later (see `.nvmrc`; run `nvm use`)
- Yarn 1 (the repository declares `packageManager`; do not use npm)
- The Expo Go app, an iOS simulator, or an Android emulator
- A TMDB account, for the API key the proxy uses

## Start the app

1. Install the dependencies:

   ```bash
   yarn install
   ```

2. Run the proxy. The app cannot load data without it. Full instructions are in
   [proxy/README.md](proxy/README.md); the short form is:

   ```bash
   cd proxy
   vercel link                       # once, to connect the project
   echo "TMDB_API_KEY=<your key>" > .env.local
   vercel dev                        # serves http://localhost:3000/api/tmdb
   ```

   Get the key from
   [your TMDB API settings](https://www.themoviedb.org/settings/api). Use **API
   Key (v3 auth)**, which is 32 characters — not the longer v4 read access
   token, which this proxy does not accept.

3. Point the app at the proxy:

   ```bash
   cp .env.example .env
   ```

   Set `EXPO_PUBLIC_TMDB_PROXY_URL` in `.env`. For the local proxy above, that
   is `http://localhost:3000/api/tmdb`.

4. Start the development server, in a second terminal:

   ```bash
   yarn start
   ```

5. Press `i` for iOS, `a` for Android, or `w` for the web.

Metro reads `.env` when it starts and caches the value. Run `yarn start --clear`
after you change `.env`, or the old value stays in the bundle.

## The key never reaches the app

**Do not put the TMDB key in the app's `.env`.** It would ship to every user.

Expo replaces each `process.env.EXPO_PUBLIC_*` read with the literal value when
it builds for production. The substitution is in
`babel-preset-expo/build/inline-env-vars.js`:

```js
if (isProduction) {
  path.replaceWith(t.valueToNode(process.env[envVar]))
}
```

The value becomes a plain string in the bundle. This applies to the web build,
the `.apk`, and the `.ipa` alike — an Android package is an archive, and the
bundle inside it can be read with `grep`. Minifying does not hide it, because a
minifier renames variables and leaves string values alone.

No client-side measure fixes this. Whatever the app can decrypt, a person
holding the app can decrypt too. So the key stays on the server, and the app
calls the proxy instead.

`EXPO_PUBLIC_TMDB_PROXY_URL` is public by design. It is an address, not a
credential.

Two guards keep this from regressing:

- **A lint rule.** `eslint.config.js` fails the build on any `process.env` read
  in `app/`, `components/`, or `lib/` whose name contains `KEY`, `SECRET`,
  `TOKEN`, or `PASSWORD`.
- **A test.** `lib/tmdb.test.ts` asserts that no request the app makes carries an
  `api_key`, and that none goes to `api.themoviedb.org` directly.

## Scripts

| Script               | Function                                         |
| -------------------- | ------------------------------------------------ |
| `yarn start`         | Starts the Expo development server.              |
| `yarn ios`           | Starts the app in the iOS simulator.             |
| `yarn android`       | Starts the app in the Android emulator.          |
| `yarn web`           | Starts the app in the browser.                   |
| `yarn typecheck`     | Generates the route types, then runs TypeScript. |
| `yarn lint`          | Runs ESLint.                                     |
| `yarn lint:fix`      | Runs ESLint and applies the fixes it can.        |
| `yarn format`        | Applies Prettier to every file.                  |
| `yarn format:check`  | Reports the files that Prettier would change.    |
| `yarn test`          | Runs Jest: the app tests and the proxy tests.    |
| `yarn test:watch`    | Runs Jest and re-runs on a change.               |
| `yarn test:coverage` | Runs Jest and reports coverage.                  |
| `yarn routes:types`  | Writes the Expo Router route types by hand.      |
| `yarn build:web`     | Exports the static web build to `dist/`.         |

CI runs `typecheck`, `lint`, `format:check`, and `test` on every push to `main`
and on every pull request.

`yarn typecheck` generates the route types first. `.expo/` is gitignored, so a
clean checkout has none, and without them a link to a route that does not exist
type-checks as a plain string and passes. See
[scripts/generate-route-types.js](scripts/generate-route-types.js).

## Tests

```bash
yarn test                            # everything
yarn test --selectProjects app       # the app only
yarn test --selectProjects proxy     # the proxy only
```

Jest runs two projects, because the proxy is server code that uses the Web
`Request` and `Response` API rather than the React Native runtime.

| Suite                               | Covers                                             |
| ----------------------------------- | -------------------------------------------------- |
| `lib/format.test.ts`                | Both TMDB sentinels, alone and together            |
| `lib/images.test.ts`                | URL building, and null for a film with no art      |
| `lib/api.test.ts`                   | The mapping, the error branches, and the paging    |
| `lib/tmdb.test.ts`                  | The transport, and that no key is ever sent        |
| `lib/motion.test.ts`                | The transition tokens and the stagger ceiling      |
| `lib/useDebounced.test.ts`          | The delay, and that one burst sends one value      |
| `components/MovieCard.test.tsx`     | The poster size and the fixed card height          |
| `components/MovieCarousel.test.tsx` | The geometry invariant, at 5 screen widths         |
| `components/Skeleton.test.ts`       | The placeholder count against the screen width     |
| `components/HeroImage.test.tsx`     | The Motion plain-path rule the hero parallax needs |
| `__tests__/app/movie/[id].test.tsx` | The detail screen: 7 states, every error           |
| `__tests__/app/search.test.tsx`     | Search: the debounce, both empty states, staleness |
| `__tests__/app/index.test.tsx`      | The home screen's search entry point and the chips |
| `__tests__/app/genre/[id].test.tsx` | The genre grid: paging, a bad id, a stale page     |
| `proxy/api/tmdb.test.ts`            | The allowlist, and that the key never comes back   |
| `proxy/api/rate-limit.test.ts`      | The ceiling, the caller identity, and failing open |

No test needs a key or a network. The proxy tests mock `fetch`, and the screen
tests mock `lib/api`.

There is also `proxy/smoke.sh`, which checks a **running** proxy — local or
deployed. It is not part of `yarn test`, because it needs a real key and network.

## Project structure

```
app/                     # Expo Router: one file is one screen
├── _layout.tsx          # Root layout with the ThemeProvider
├── index.tsx            # Home screen
├── search.tsx           # Search screen, debounced as you type
├── genre/[id].tsx       # One genre, as an endless grid
└── movie/[id].tsx       # Film detail screen
components/
├── MovieCarousel.tsx    # The featured row, with the scale effect
├── CarouselCard.tsx     # One card in the carousel
├── MovieRow.tsx         # A compact horizontal row
├── MovieCard.tsx        # One card in a row
├── GenreChips.tsx       # The genre shortcuts under the home header
└── Skeleton.tsx         # The loading placeholders
lib/
├── api.ts               # The seam. The only data file a screen imports
├── tmdb.ts              # The transport. Calls the proxy
├── config.ts            # Reads the proxy URL from the environment
├── types.ts             # Movie, Paged, and Genre, in the TMDB field shape
├── mock.ts              # Static film data, now a test fixture only
├── images.ts            # Builds a TMDB image URL from a path fragment
├── format.ts            # Rating and year labels
├── motion.ts            # The shared transition tokens and the stagger
├── useDebounced.ts      # Delays a value until it stops changing
└── test-utils.tsx       # render() wrapped in the app's providers
proxy/                   # The TMDB proxy. Deploys on its own
├── api/tmdb.ts          # The function that holds the key
├── api/rate-limit.ts    # The per-caller request ceiling
└── smoke.sh             # Checks a running proxy
__tests__/               # Tests that do not sit beside their subject
scripts/                 # generate-route-types.js
assets/                  # App icons, the splash screen, the README QR code
theme.ts                 # The Material 3 light and dark themes
app.json                 # Expo configuration
app.config.js            # Adds `baseUrl` for the GitHub Pages build
eas.json                 # EAS build and update profiles
jest.config.js           # Two projects: app and proxy
eslint.config.js         # Includes the rule that bans a key in app code
CLAUDE.md                # Instructions for AI agents
```

## How the data layer works

`lib/api.ts` is the single seam between the UI and the data. Every screen imports
from it and from nowhere else.

The seam has now proved itself twice. The functions were written `async` against
static mock data first, so the screens already handled latency and failure.
Moving to the live TMDB API changed `lib/api.ts` and added `lib/tmdb.ts` beneath
it. Moving from a direct TMDB call to the proxy changed `lib/tmdb.ts` and
`lib/config.ts`. **Neither change touched a screen.**

| File            | Function                                                             |
| --------------- | -------------------------------------------------------------------- |
| `lib/api.ts`    | The seam. Maps a TMDB response to the `Movie` type.                  |
| `lib/tmdb.ts`   | The transport. Calls the proxy and turns a bad status into an error. |
| `lib/config.ts` | Reads the proxy URL. Throws `MissingProxyUrlError` when absent.      |

A setup mistake is a distinct error type from a failed request, so the app prints
the instruction that fixes it rather than "Could not load movies", which would
send a developer to check their network.

`lib/types.ts` uses the TMDB field names — `poster_path`, `vote_average` — on
purpose. The mock data and the live data share one type.

## Technology

- Expo SDK 54 and Expo Router 6
- React Native 0.81 and React 19
- `@rootnative/core` — the theme system with Material Design 3 tokens
- `@rootnative/components` — the UI components
- `@rootnative/inertia` — the animation primitives, over Reanimated
- TypeScript
- Jest and `@testing-library/react-native`
- Vercel Functions, for the proxy

## Deployment

Three things deploy, and the proxy is separate from the other two.

| What                                                 | Publishes             | Target                                  |
| ---------------------------------------------------- | --------------------- | --------------------------------------- |
| [`deploy.yml`](.github/workflows/deploy.yml)         | The static web build  | GitHub Pages                            |
| [`eas-update.yml`](.github/workflows/eas-update.yml) | The JavaScript bundle | The EAS `main` channel, for the QR code |
| [`proxy/`](proxy/README.md)                          | The TMDB proxy        | Vercel, by hand                         |

The two workflows run on every push to `main`. The proxy deploys separately, with
`vercel deploy --prod`, because it changes rarely and holds the key.

The QR image never changes. It points at the channel, and the workflow moves the
channel to the newest bundle.

To publish an app update by hand:

```bash
npx eas update --branch main --message "What changed"
```

### Setup that this repository cannot do for itself

Six steps need a web interface:

1. **Turn on Pages.** In `Settings → Pages`, set **Source** to **GitHub
   Actions**. The deploy workflow fails until this is set.
2. **Add the `EXPO_TOKEN` secret.** Make a token at
   [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens),
   then add it in `Settings → Secrets and variables → Actions`. The EAS workflow
   skips its steps without it.
3. **Add the `EXPO_PUBLIC_TMDB_PROXY_URL` variable.** In
   `Settings → Secrets and variables → Actions`, on the **Variables** tab — not
   the Secrets tab. The proxy URL is public, and storing it as a secret would
   suggest it needs protecting. Both workflows read it, and the published app
   cannot load data without it.
4. **Give the proxy its key.** `vercel env add TMDB_API_KEY production`, then
   deploy again. See [proxy/README.md](proxy/README.md).
5. **Give the proxy its Redis credentials.** Create a database at
   [console.upstash.com](https://console.upstash.com/), then add
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them the
   proxy runs with **no rate limit** and reports nothing. See
   [proxy/README.md](proxy/README.md).
6. **Require the CI check.** In `Settings → Branches`, add a rule for `main` and
   mark the `check` job as required. Until then CI reports a failure but does not
   stop a merge.

## More information

- [RootNative UI documentation](https://rootnative.github.io/ui)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)
- [Expo documentation](https://docs.expo.dev/)
- [TMDB API reference](https://developer.themoviedb.org/reference/intro/getting-started)
