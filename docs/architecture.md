# Architecture

This page explains how Reelist gets its data, and why each part has its shape.
To run the app, start with the [README](../README.md) and
[development.md](development.md).

- [The key never reaches the app](#the-key-never-reaches-the-app)
- [How the data layer works](#how-the-data-layer-works)
  - [How a screen loads](#how-a-screen-loads)
  - [The person screen](#the-person-screen)
  - [The trailer player](#the-trailer-player)
- [The watchlist](#the-watchlist)

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

- **A lint rule.** [eslint.config.mjs](../eslint.config.mjs) fails the build on
  any `process.env` read in `app/`, `components/`, or `lib/` whose name contains
  `KEY`, `SECRET`, `TOKEN`, or `PASSWORD`.
- **A test.** `lib/tmdb.test.ts` asserts that no request the app makes carries an
  `api_key`, and that none goes to `api.themoviedb.org` directly.

## How the data layer works

`lib/api.ts` is the single seam between the UI and the data. Every screen imports
from it and from nowhere else.

The seam has now proved itself twice. The functions were written `async` against
static mock data first, so the screens already handled latency and failure.
Moving to the live TMDB API changed `lib/api.ts` and added `lib/tmdb.ts` beneath
it. Moving from a direct TMDB call to the proxy changed `lib/tmdb.ts` and
`lib/config.ts`. **Neither change touched a screen.**

Adding the cast, the trailer, and the "More like this" row was a different kind
of proof. The detail screen draws three new sections, so that file did change.
What did not change is the way it loads them: no second request, no extra state,
and no extra effect. TMDB includes all three inside the film response when the
request carries `append_to_response`, so `getMovie` returns three more fields on
the type it already returned. The compiler then named every file that had to
follow, starting with `lib/mock.ts`.

| File            | Function                                                             |
| --------------- | -------------------------------------------------------------------- |
| `lib/api.ts`    | The seam. Maps a TMDB response to the app's own types.               |
| `lib/tmdb.ts`   | The transport. Calls the proxy and turns a bad status into an error. |
| `lib/config.ts` | Reads the proxy URL. Throws `MissingProxyUrlError` when absent.      |

A setup mistake is a distinct error type from a failed request, so the app prints
the instruction that fixes it rather than "Could not load movies", which would
send a developer to check their network.

`lib/types.ts` uses the TMDB field names — `poster_path`, `vote_average` — on
purpose. The mock data and the live data share one type.

### How a screen loads

Every screen asks for its data through `useResource`, and no screen writes a
fetch effect of its own.

Each of the four wrote the same block before it: a state for the data, one for
the failure, one for the loading flag, a counter the retry button raised, and an
`active` flag that kept a late answer off a screen the reader had left. Three of
them also tagged the stored answer with the id or the query it described,
because either can change while a request is in flight.

```ts
const detail = useResource(validId ? `movie:${movieId}` : null, () => getMovie(movieId), 'Could not load the movie')
```

The hook returns `data`, `failure`, `loading`, `reload`, `refresh`, and
`refreshing`. A `null` key is an idle resource: it sends no request and reports
no failure, which is what makes an empty search box not a search, and a link
that names no film not a loading screen.

`lib/resourceCache.ts` keeps each answer for five minutes, under the ten minutes
the proxy caches at its edge. A return to the home screen therefore draws the
rows on the first frame instead of loading them again. After five minutes the
old copy stays on screen while the new request runs, and a failed refresh leaves
it there rather than replacing films the reader can see with an error.

`reload` and `refresh` both ask again. They differ in what the reader sees:

- `reload` is the retry button on a failed screen. It clears the answer, so the
  placeholders come back while the request runs.
- `refresh` is the pull to refresh on the home and the genre lists. The list
  stays on screen while the request runs, and `refreshing` drives the spinner.
  It resolves `false` when the request fails. The list then stays, and the
  screen shows a short "Could not refresh" snackbar.

`components/PullToRefresh.tsx` gives the native `RefreshControl` the theme
colours, because it sits outside the theme. The browser shows no pull to
refresh. The watchlist has none: it reads the device, and it has no request to
repeat.

One thing stayed in a screen. `app/(main)/genre/[id].tsx` appends page after
page as the reader scrolls, and that is a growing list rather than the answer to
one request. The hook holds its first page, which is why a return to the same genre
is immediate. A pull to refresh on the grid loads the first page again. The
later pages go when the new first page lands, because the reader pulled at the
top and the list starts there again.

### The person screen

A cast card opens `app/(main)/person/[id].tsx`, which shows who the person is
and every film TMDB credits them with. It is one request, for the same reason the film
screen is: `/person/{id}` carries the filmography when the request appends
`movie_credits`. That is a second allowed value in the proxy, beside the film
one — see [proxy/README.md](../proxy/README.md).

Two rules live in `lib/api.ts` rather than in the screen, because both come from
the shape of the response. TMDB returns a filmography in no order a reader would
expect, so the mapping sorts it newest first and puts the announced films last.
And a performer credited twice in one film — a dual role, or a voice part beside
a screen part — gets one entry per credit under the same film id, which would
hand FlatList two children with one key.

The screen is one list with the profile as its header, not a scroll view holding
a grid. A working actor has a hundred credits, and a grid inside a scroll view
mounts every card at once. The name is drawn once: the floating bar carries it
only after the profile has scrolled away, which is the arrangement
`components/DetailHeader.tsx` was built for on the film screen.

### The trailer player

The "Watch trailer" button opens `app/(main)/trailer/[key].tsx` rather than
handing the video to YouTube. The app used to call `openURL` and leave, which lost the
reader to another app and lost the scroll position on the way back. A route of
its own keeps the detail screen mounted underneath, and it earns the system back
gesture and the Android hardware back button without any code.

The screen makes no request. `getMovie` already chose the video, and the key is
the whole of what a player needs, so it travels in the route with the film title
beside it. That is why the player has no loading state and no failure state of
its own.

There are two player files. `components/TrailerPlayer.tsx` draws a web view, and
`components/TrailerPlayer.web.tsx` draws an iframe. The split is not a
preference: `react-native-webview` has no web build, and one file would pull a
native-only module into the browser bundle. Metro picks the `.web` file for the
web target, so the native one never reaches it. The web file imports the prop
type from the native one and no value from it, so the two surfaces cannot drift
apart.

The two load the embed differently, and that difference is the whole reason
`embedPage` in `lib/youtube.ts` exists. **YouTube checks the `Referer` header on
every embed request, and it answers a bad one inside the frame rather than
failing.** The player draws an error code, the video never plays, and nothing
throws that the app could catch. The screen met two of those codes in turn on an
iOS device, while the browser build played the same trailer throughout:

| Code  | What the player showed             | What the referrer was     |
| ----- | ---------------------------------- | ------------------------- |
| `153` | "Video player configuration error" | None                      |
| `152` | "This video is not available"      | `https://www.youtube.com` |

A web view pointed straight at the embed URL makes that URL the top-level
document, and a top-level document has no referrer to send — that is the 153.
Wrapping the embed in a local page fixed the absence but not the value: a page
served as youtube.com is an embed of YouTube inside YouTube, which YouTube
refuses, and that is the 152.

So the page needs both halves together. The embed sits in an iframe with a
parent document, and that document claims a real third-party site through the
web view's `baseUrl` — `PLAYER_ORIGIN`, which is this app's own web build at
`https://reelist.raajnadar.in`. The referrer the phone sends is then the
referrer the working browser build already sends. That build needs none of
this, because its iframe already sits in a real page on that site.

The player always offers a button that opens the video in YouTube itself. That
is not a fallback after a failure, because there is no failure to catch: a studio
can block a video from embedding, and TMDB still lists it. The embed then loads
and plays nothing but the words "Video unavailable". The app cannot tell that
apart from a slow start without the YouTube frame API, so it keeps the way out
visible instead.

## The watchlist

The watchlist is the one thing in the app that belongs to the reader rather than
to TMDB, and it is the only state written to the device.

`lib/watchlist.ts` holds the saved films in memory and mirrors them to
AsyncStorage under one key. It is a module with a `useSyncExternalStore` hook
over it, not a React context: the detail screen and the watchlist screen are
often mounted together, and both have to see one press. The root layout gains no
provider for it.

A save and an unsave each show a snackbar. An unsave offers "Undo", which puts
the film back at its old place in the list. A save has nothing to undo, so it
offers "View", which opens the watchlist. Both stay for the long duration,
because a snackbar with an action otherwise waits until the reader dismisses it.

A saved film is stored whole, not as an id. A grid of ids would need one request
per card before it could draw anything, and a watchlist that cannot open offline
is not worth keeping. The store narrows a `MovieDetail` to the seven fields a
card reads, so a save does not put the cast, the videos, and twenty recommended
films on the device.

The screen has two tabs, "To watch" and "Watched", and a progress bar over the
grid, for example "12 of 30 films watched". "Select films" in the options menu
puts a checkbox on each card. A press then picks the film and does not open
it. The bar offers "Select all", "Mark as watched" ("Mark as not watched" on
the Watched tab), and "Remove from watchlist". Each action shows a snackbar
with "Undo". Back on Android and Escape on the web end select mode, not the
screen. On the web, Space picks the focused card, as it does a checkbox.

The mark is an optional `watched: true` on the stored film. A film to watch
has no field at all, so a list from before the mark reads as all to watch, and
the key stays `reelist.watchlist.v1`. A film keeps its place in the list when
the reader marks it, so the date-added order of each tab does not change.

Three states the code treats as real rather than impossible:

1. **The device copy is unread.** The screen shows placeholders until the read
   finishes. Without that, a reader with a full watchlist sees "Nothing saved
   yet" for a frame on every cold start.
2. **The device copy is damaged.** A process the system kills mid-write leaves a
   half-written string. `parseStored` returns an empty list for it and drops any
   entry with no numeric id, because a film with no id reaches FlatList as a
   child with no key.
3. **Storage cannot be read or written.** A browser in private mode, or a full
   disk. The list in memory is still correct, so the app keeps working and the
   failure is not reported: there is no action a message could offer.
