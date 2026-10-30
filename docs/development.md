# Development

This page explains how to set up Reelist, run it, test it, and find your way in
the code. The [README](../README.md) has the short form.

- [Requirements](#requirements)
- [Start the app](#start-the-app)
- [The web build](#the-web-build)
- [Scripts](#scripts)
- [Tests](#tests)
- [Project structure](#project-structure)

## Requirements

- Node.js 24 or later (see `.nvmrc`; run `nvm use`)
- Yarn 1 (the repository declares `packageManager`; do not use npm)
- The [Vercel CLI](https://vercel.com/docs/cli), to run the proxy
- The Expo Go app, an iOS simulator, or an Android emulator
- A TMDB account, for the API key the proxy uses

## Start the app

1. Install the dependencies. The proxy has its own, and `vercel dev` and the
   proxy tests need them:

   ```bash
   yarn install
   yarn --cwd proxy install
   ```

2. Run the proxy. The app cannot load data without it. Full instructions are in
   [proxy/README.md](../proxy/README.md); the short form is:

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

A phone cannot reach `localhost`, because on a device `localhost` is the phone
itself. On a phone, use the address of the computer on the network. The
simulator and the web build can use `localhost`. See
[proxy/README.md](../proxy/README.md#run-it-locally).

## The web build

The web build is at **https://reelist.raajnadar.in/**. It updates on every
push to `main`.

The export is static: one HTML file per route, plus one per film in the three
home lists. The deploy fetches that list with `yarn prerender:seed` before it
exports, so a search engine gets each of those films with its text and its head
tags. Every other film loads in the browser. See `lib/prerender.ts`.

The server lays each page out for a 0 by 0 window, and React keeps a mismatched
inline style from that HTML after hydration. So a screen reads the window
through `useWindowDimensions` from `@rootnative/core`, which reports the
server's window until the page is hydrated. ESLint rejects the `react-native` hook in app code.

The browser build has no gestures and no native animation driver, so the carousel
feels different there. Use the phone build to judge the motion.

## Scripts

| Script                | Function                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `yarn start`          | Starts the Expo development server.                                   |
| `yarn ios`            | Starts the app in the iOS simulator.                                  |
| `yarn android`        | Starts the app in the Android emulator.                               |
| `yarn web`            | Starts the app in the browser.                                        |
| `yarn typecheck`      | Generates the route types, then runs TypeScript.                      |
| `yarn lint`           | Runs ESLint.                                                          |
| `yarn lint:fix`       | Runs ESLint and applies the fixes it can.                             |
| `yarn format`         | Applies Prettier to every file.                                       |
| `yarn format:check`   | Reports the files that Prettier would change.                         |
| `yarn test`           | Runs Jest: the app, the DOM, and the proxy tests.                     |
| `yarn test:watch`     | Runs Jest and re-runs on a change.                                    |
| `yarn test:coverage`  | Runs Jest and reports coverage.                                       |
| `yarn routes:types`   | Writes the Expo Router route types by hand.                           |
| `yarn prerender:seed` | Writes `lib/prerender.json`: the films the export prerenders.         |
| `yarn export:web`     | Exports the static web build to `dist/`.                              |
| `yarn seo`            | Writes `sitemap.xml` and `robots.txt` into `dist/`.                   |
| `yarn seo:audit`      | Checks the head tags and the structure of each page in `dist/`.       |
| `yarn seo:browse`     | Loads each page in `dist/` in headless Chrome, and fails on an error. |
| `yarn verify`         | Runs lint, typecheck, format:check, and test.                         |

CI runs two jobs on every push to `main` and on every pull request:

- **`check`** runs `typecheck`, `lint`, `format:check`, and `test`.
- **`web`** runs `export:web`, then `seo`, `seo:audit`, and `seo:browse`.

`yarn typecheck` generates the route types first. `.expo/` is gitignored, so a
clean checkout has none, and without them a link to a route that does not exist
type-checks as a plain string and passes. See
[scripts/generate-route-types.js](../scripts/generate-route-types.js).

## Tests

```bash
yarn test                            # everything
yarn test --selectProjects app       # the app only
yarn test --selectProjects dom       # the tests that need React DOM
yarn test --selectProjects proxy     # the proxy only
```

Jest runs three projects, from [jest.config.js](../jest.config.js):

| Project | Runs                       | Why it is separate                                                       |
| ------- | -------------------------- | ------------------------------------------------------------------------ |
| `app`   | Every other `*.test.ts(x)` | The React Native runtime, with the app's setup file.                     |
| `dom`   | `*.dom.test.ts(x)`         | A test that hydrates the static web export needs a DOM.                  |
| `proxy` | `proxy/**/*.test.ts`       | The proxy is server code that uses the Web `Request` and `Response` API. |

A test sits beside its subject. A screen test sits in `__tests__/app/`, at the
path of its route.

No test needs a key or a network. The proxy tests mock `fetch`, and the screen
tests mock `lib/api`.

There is also `proxy/smoke.sh`, which checks a **running** proxy — local or
deployed. It is not part of `yarn test`, because it needs a real key and network.

## Project structure

```
app/                 # Expo Router: one file is one screen
├── _layout.tsx      # Root layout with the ThemeProvider
├── (main)/          # Every page with the navigation around it
├── search.tsx       # The search sheet
└── about.tsx        # The settings sheet
components/          # The parts that screens share
lib/                 # Data, hooks, and stores. lib/api.ts is the only data file a screen imports
proxy/               # The TMDB proxy. It deploys on its own
__tests__/           # Screen tests, at the path of their route
scripts/             # Route types, the prerender seed, and the not-found head
assets/              # App icons, the splash screen, the logo, and the README images
public/              # Files the web build serves as they are
docs/                # These pages
theme.ts             # The Material 3 light and dark themes
app.json             # Expo configuration
app.config.js        # Adds `baseUrl` for a GitHub Pages subpath
eas.json             # EAS build profiles, each with its own update channel
jest.config.js       # Three projects: app, dom, and proxy
eslint.config.mjs    # The rules that ban a key in app code and a literal Button size
CLAUDE.md            # Instructions for AI agents
```
