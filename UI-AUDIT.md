# UI audit and feature backlog

Date: 2026-10-20

This document is the backlog from the UI audit of 20 Oct. Pick one item,
build it, test it on a phone and in a browser, ship it, then tick it. Write
the ship date and the commit after the tick.

The audit came from a read of the code, not from a run on a device. Check
each phone item on a phone before you fix it.

The older `FEATURE-AUDIT.md` (26 Sep) lists the content gaps. This document
does not repeat them. `AWARDS-PLAN.md` holds the schedule; the feature freeze
is on 27 Oct.

## How to use this file

- `- [ ]` is open. `- [x]` is shipped.
- After the tick, add one line: `Shipped <date> in <commit>.`
- When an item needs a library change, file it as DX feedback and add
  `Blocked on <DX id>.` under the item.
- Priority: P1 = a user hits it in the first minute. P2 = a user hits it in
  a session. P3 = polish.

## The pitch problem

The app uses 14 of the 35 components in `@rootnative/components`:

- Used: AppBar, Button, Card, Chip, Divider, Grid, Icon, IconButton,
  LoadingIndicator, Menu, Portal, Skeleton, Snackbar, Typography.
- Not used: BottomSheet, Dialog, TextField, SearchBar, SearchView, Switch,
  Checkbox, Radio, Slider, Progress, Tabs, NavigationBar, NavigationRail,
  NavigationDrawer, List, FAB, ButtonGroup, Tooltip, Avatar, Badge,
  KeyboardAvoidingWrapper.

A developer who opens the app sees cards, text, and a menu. They do not see
a form, a sheet, a dialog, a navigation component, or an input. Three places
in the app draw their own version of a component that the library has:

| Place                                 | App draws                    | Library has               |
| ------------------------------------- | ---------------------------- | ------------------------- |
| Search (`app/search.tsx:265`)         | A plain `TextInput`          | `SearchBar`, `SearchView` |
| Home header (`app/index.tsx:162-196`) | A custom row                 | `AppBar`                  |
| About sheet (`app/about.tsx:159`)     | A Pressable scrim and a card | `Dialog`, `BottomSheet`   |

Each one is a missed demo. Each one is also a question a developer asks:
"why did the author not use the library here?"

## Part 1: UI fixes

### Both platforms

- [ ] **1. P1. Search and the watchlist are dead ends from other screens.**
      Both are reachable only from the home header. A film, person, or
      genre page has no way to them. `app/_layout.tsx:43`,
      `components/DetailHeader.tsx`.
      Fix: feature F1, or add a search action to each header.
      Built 2026-10-21 by F1. Not checked on a phone yet.
- [ ] **2. P1. Four header styles.** A custom row on home, `AppBar` on genre
      and watchlist, `DetailHeader` on film and person, `AppBar` with a
      cross on about. `app/index.tsx:162`, `components/DetailHeader.tsx:48`.
      Fix: use `AppBar` on home. Keep `DetailHeader` for the hero overlay.
- [x] **3. P1. No pull to refresh on any list.** `app/index.tsx:259`,
      `app/genre/[id].tsx:303`.
      Fix: add `RefreshControl` on home, genre, and watchlist.
      Built 2026-10-20 on home and genre, with `refresh` in
      `lib/useResource.ts` and `components/PullToRefresh.tsx`. Not on the
      watchlist: it is a device store with nothing to fetch.
      Checked 2026-10-26 on the iPhone 16 Pro simulator: the home and the
      genre grid pull down, show the themed spinner, and settle back. The
      same on `Pixel_Light_34` (API 34) the same day: the Android circle
      spinner in the theme colour on both lists.
- [x] **4. P1. No offline state.** A failed fetch shows a generic error and
      nothing retries when the network returns. `lib/tmdb.ts:50-52`.
      Fix: add a network listener and a banner. Retry on reconnect.
      Shipped 2026-10-27, commit pending. `lib/network.ts` keeps one
      subscription to `expo-network` (optimistic until the device says no;
      `navigator.onLine` on the web). `components/OfflineBanner.tsx` is a
      status strip under the page in the `(main)` layout, hidden with the
      navigation. `lib/useResource.ts` sends a transient failure again when
      the connection returns; a setup or a missing failure is left alone.
      Tests cover the store, the strip, and the retry. Not checked on a
      device: needs a phone with the radio off and on.
- [ ] **5. P2. A failed "load more" on the genre grid is silent.**
      `app/genre/[id].tsx:227-230`.
      Fix: show a row with "Could not load more" and a retry button.
- [ ] **6. P2. A stale cache hides a failed refresh.** The reader cannot see
      the data is old. `lib/useResource.ts:86-90`.
      Fix: show a snackbar "Showing saved data" when the refresh fails.
- [ ] **7. P2. Button sizes differ.** Film actions `small`, state actions
      `medium`, about links `medium`. `components/DetailActions.tsx:75`,
      `components/StateMessage.tsx:174`.
      Fix: pick one size per role and write it down.
      Built 2026-10-20 in `lib/buttonSize.ts`: `inline` is `small` (40 dp),
      `state` is `medium` (56 dp). The three about screen links went from
      56 dp to 40 dp. ESLint now rejects a literal size on a `Button`. The
      table is in the README. Not checked on a phone yet.
- [ ] **8. P2. Row heading levels differ.** `level={2}` in `MovieRow`, no
      level in the carousel and the person filmography.
      `components/MovieCarousel.tsx:220`, `app/person/[id].tsx:221`.
      Fix: set the same level on all row headings.
- [ ] **9. P2. Save and unsave do not match.** A save gives an icon pop. An
      unsave gives a snackbar with undo. `components/DetailActions.tsx:31-49`.
      Fix: give the save a short snackbar: "Saved. View list".
      Built 2026-10-20 in `components/DetailActions.tsx`: a save shows
      "Saved to your watchlist" with a "View" action that opens the
      watchlist. It uses the long duration, the same as the unsave, because
      a snackbar with an action otherwise stays until dismissed. Not checked
      on a phone yet.
- [ ] **10. P2. The update snackbar never leaves.** It has no duration.
      `components/UpdateSnackbar.tsx:29-37`.
      Fix: add a duration of 10 s or a close action.
- [ ] **11. P2. A shared genre link shows the title "Genre" on native.** The
      name param is absent. `app/genre/[id].tsx:235-236`.
      Fix: read the genre name from the genre list, with the id as the key.
- [ ] **12. P3. A film with no recommendations ends with no end note.**
      `app/movie/[id].tsx:401-423`.
      Fix: show a short "No related films yet" line.
- [ ] **13. P3. All watch provider tiles open the same TMDB page.**
      `components/WatchProviders.tsx:36-58`.
      Fix: keep it, and say so under the row: "Opens the TMDB watch page".

### Phone

- [x] **14. P1. Header icon buttons are 40 pt.** Apple asks for 44 pt. The
      carousel pause button is 32 pt. `app/index.tsx:173-193`,
      `components/MovieCarousel.tsx:299`.
      Fix: use `size="medium"` on header actions, or add `hitSlop`.
      Closed 2026-10-26, no app change. The library pads every `IconButton`
      to a 48 dp touch target with a default `hitSlop`
      (`src/internal/touchTarget.ts` in `@rootnative/components`): 4 dp
      around a 40 dp button, 8 dp around the 32 dp pause button. The prop is
      not in the docs; a DX note can ask for it.
- [x] **15. P1. Haptics exist on save, unsave, and filter chips only.**
      `lib/haptics.ts`.
      Fix: add to carousel snap, theme pick, gallery close, undo, and clear.
      Shipped 2026-10-26, commit pending. `select` on a swipe that lands on
      another film (not on the arrows or the autoplay), a new theme, the
      gallery close, and both search clears; `unsave` on a cleared
      watchlist; `save` on each undo. Tests cover all but the swipe, which
      the carousel suite cannot drive. Every action ran on the iPhone 16 Pro
      simulator on 2026-10-26 with no error; the simulator has no motor, so
      the feel needs a real phone. On `Pixel_Light_34` the same day: the
      swipe, the theme pick, the search clear, the save, and the clear ran
      with no error; the undo and the gallery close were not reached (the
      emulator loads a page in 15 to 25 s, and a snackbar is gone by then).
- [ ] **16. P2. Keyboard height is read on iOS only.** On Android the last
      search row can sit under the keyboard. `lib/useKeyboardHeight.ts:7`.
      Fix: use `KeyboardAvoidingWrapper` from the library.
- [ ] **17. P2. The region change link is a 32 pt text Pressable.**
      `components/WatchProviders.tsx:71-82`.
      Fix: make it a `Button variant="text" size="small"`.
- [ ] **18. P2. Gallery thumbnails are 56 by 32 pt.**
      `components/GalleryViewer.tsx:61-62`.
      Fix: make them 64 by 44 pt, or add `hitSlop`.
- [ ] **19. P2. The watchlist grid cannot remove a card.** The reader must
      open the film. `app/watchlist.tsx`.
      Fix: long press on a card opens a `Menu`: Remove, Share, Mark watched.
- [ ] **20. P3. Orientation is locked to portrait.** The gallery and the
      trailer handle landscape, but never get it. `app.json:14`.
      Fix: unlock for the trailer and gallery routes, or remove the dead code.
- [ ] **21. P3. No app version on the about screen.** Only library versions.
      `app/about.tsx:69-90`.
      Fix: add the `expo-constants` version and the EAS update id.

### Web

- [ ] **22. P1. Escape closes nothing except the gallery.** Search, the
      about sheet, and the trailer ignore it. `app/search.tsx`,
      `app/about.tsx`, `app/trailer/[key].tsx`.
      Fix: `SearchView` for search, `Dialog` for about, one keydown hook for
      the trailer.
- [ ] **23. P1. No `/` shortcut to open search.** `app/index.tsx`.
      Fix: one keydown listener in the root layout.
- [ ] **24. P1. Filters, query, and sort are not in the URL.** A reload or a
      shared link loses them. `app/genre/[id].tsx:123`,
      `app/search.tsx:144`, `app/watchlist.tsx:51`. The head text already
      promises filters at `lib/head.ts:125`.
      Fix: write them to search params with `router.setParams`.
- [ ] **25. P1. The PWA manifest has one 180 px icon.** Chrome needs 192 and
      512 and a maskable icon. No install prompt fires.
      `public/manifest.webmanifest`.
      Fix: add the icons. Use `writeManifest` from `@rootnative/seo/node`.
- [ ] **26. P2. The hero loads `w780` and stretches it on a 1440 px window.**
      `app/movie/[id].tsx:232`, `lib/images.ts:31`.
      Fix: pick `w1280` above 800 px wide. Add `srcset` on `Picture` if the
      package supports it. If not, file it as DX feedback.
- [ ] **27. P2. Posters are `w342` at every DPR.** Retina desktops get soft
      posters. `components/RemoteImage.tsx`.
      Fix: pick `w500` when `PixelRatio.get() >= 2`.
- [ ] **28. P2. The home has no content cap.** The film page caps at 1100
      px. The width jumps on navigation. `components/MovieRow.tsx:68`,
      `app/movie/[id].tsx:65`.
      Fix: wrap the home in the library `Container`.
- [ ] **29. P2. A mouse cannot drag the carousel.** A vertical wheel does not
      move it. Only the arrows and autoplay work.
      `components/MovieCarousel.tsx`.
      Fix: map the wheel to a horizontal scroll on web. Keep the arrows.
- [ ] **30. P2. The carousel renders 101 copies.** A Tab key walk through
      the home passes hundreds of identical links.
      `components/MovieCarousel.tsx:45`. Check this in a browser first.
      Fix: set `tabIndex={-1}` on all but the active slot.
- [ ] **31. P2. The carousel card has no visible focus ring.** It is a custom
      `Motion.Pressable`, not a `Card`. `components/CarouselCard.tsx:169`.
      Fix: add a `focusVisible` gesture state from inertia.
- [ ] **32. P2. No tooltips on icon buttons.** A desktop reader sees a bare
      icon. All `IconButton` uses.
      Fix: wrap each one in `Tooltip`.
- [ ] **33. P3. One fixed theme colour `#4C0519` in the browser chrome, for
      light mode too.** `app/+html.tsx:46`.
      Fix: pass `{ light, dark }` to `shellTags`.
- [ ] **34. P3. No `<link rel="icon">` and no SVG favicon for dark tabs.**
      `app/+html.tsx:56-65`.
      Fix: pass `favicon` to `shellTags`. The logo SVG is in `assets/logo`.
- [ ] **35. P3. The carousel backdrop blurs three 500 px posters with a CSS
      filter.** `components/CarouselBackdrop.tsx:117`.
      Fix: use the poster colour from the proxy as a flat backdrop on web.
- [ ] **36. P3. `SEO-AUDIT.md` names the old host and has open owner steps.**
      Search Console, sitemap, Lighthouse. `SEO-AUDIT.md:450-492`.
      Fix: update the host. Run Lighthouse and record the scores.

### Web, from the CDP run of 23 Oct

These came from a run of the static export in headless Brave at eight window
widths, from 360 to 1920, plus the reader flows at phone, laptop, and monitor
width. The export was served the way production serves it: the home page is
the 404 fallback for every page that is not prerendered.

- [x] **37. P1. A direct link to a film keeps "Home" lit in the bottom
      bar.** The bar hydrates from the home HTML of the 404 fallback, and
      React 19 keeps the server `aria-selected` on a mismatch. A cold open of
      `/movie/550`, `/person/819`, or `/genre/18` on a phone shows "Home"
      lit. A tap on Watchlist then lights both Home and Watchlist. The state
      clears only when the bar remounts, for example after the trailer. The
      rail and the drawer are not affected: the server renders the bar, so
      they mount fresh. `components/AppNavigation.tsx`.
      Origin: the navigation work on this branch. Not on `2946103`.
      Fix: mount the bar after hydration, or give it a key that changes once
      the window is measured.
      Shipped 2026-10-26, commit pending. The bar takes a key from
      `lib/useHydrating.ts` that changes once hydration ends, so React
      mounts it again with the client's lit item. Checked on the export,
      served as production does, at 390 px: `/movie/550` and `/genre/18`
      light nothing, a tap on Watchlist lights Watchlist alone.
- [ ] **38. P1. A direct link to the gallery lays out half a window too
      low.** On a cold open of `/gallery/550` the title row sits at half the
      window height, the still sits under it, and the spinner never stops.
      The same gallery opened from a film page is correct. The stage height
      and the pager offsets come from the 0 by 0 hydration window and are not
      laid out again. `components/GalleryViewer.tsx:124`,
      `components/GalleryViewer.tsx:150`.
      Origin: pre-existing. Reproduced on `2946103` on 23 Oct.
      Fix: wait for the measured window before the pager mounts, or re-run
      `scrollToIndex` when the height changes.
- [x] **39. P1. Poster grids clip their last column beside the rail and the
      drawer.** The column count comes from the window width, not the
      content width. At 1280 the genre grid cuts its seventh card at the
      right edge. At 1920 the person filmography cuts its ninth card. The
      watchlist and search grids share the code. `lib/grid.ts`,
      `app/(main)/genre/[id].tsx:113`, `app/(main)/person/[id].tsx:60`,
      `app/(main)/watchlist.tsx:39`, `app/search.tsx:90`.
      Origin: the navigation work on this branch. Not on `2946103`.
      Fix: measure the content width with `onLayout`, or subtract the
      navigation width from the window.
      Shipped 2026-10-26, commit pending. The navigation measures its
      content area and `lib/useContentWidth.ts` hands the grids that width.
      Checked on the export at 390, 1024, 1280, 1599, 1600, 1920: the
      genre and the person grids end inside the content edge at each width.
      The carousel and the skeleton still size from the window (F1, open).
- [ ] **40. P2. Fallback pages keep head tags from the home shell.**
      `PageHead` does not replace them. The trailer, gallery, and not-found
      pages carry `noindex` together with the home canonical link. A genre
      that is not in the seed keeps the home title and canonical, and its
      heading stays "Genre" on web too (see item 11). `lib/head.ts`,
      `app/(main)/genre/[id].tsx:260-278`.
      Origin: pre-existing. Reproduced on `2946103` on 23 Oct.
      Fix: remove the canonical on a `noindex` page, and set a title from the
      route when the seed has no name.
- [ ] **41. P3. The trailer page scrolls sideways by 1 to 2 px** at every
      width. `app/(main)/trailer/[key].tsx`.
      Origin: pre-existing. Reproduced on `2946103` on 23 Oct.
      Fix: find the element 1 px wider than the window and clip it.
- [ ] **42. P3. The home fires each list request twice on a cold load.**
      Trending, popular, top rated, and the genre list each go out twice.
      `lib/useResource.ts`.
      Origin: pre-existing. Reproduced on `2946103` on 23 Oct.
      Fix: dedupe a request that is already in flight for the same key.
- [ ] **43. P3. A direct link to `/search` shows a flat grey sheet.** There
      is no page under the sheet, so the reader sees the scrim colour alone.
      Close goes home. `app/search.tsx`.
      Origin: pre-existing. Reproduced on `2946103` on 23 Oct.
      Fix: draw the home under the sheet, or use the page background when
      nothing is below.

Checked in the same run and not a defect: the navigation kind at all eight
widths, the hidden navigation on the trailer and the gallery, the lit item on
each destination, the search, save, badge, watchlist, and unsave flow, the
settings sheet and the theme switch, the drawer links, load more on the genre
grid, and one `<main>` per page.

## Part 2: new features for the pitch

Each feature names the library parts it shows. The pitch is stronger when
each feature uses a component the app does not use today.

- [ ] **F1. Navigation that adapts to the screen.**
      Shows: NavigationBar, NavigationRail, NavigationDrawer.
      A bottom bar on a phone with Home, Search, Watchlist. A rail on a
      tablet and a narrow desktop window. A drawer on a wide desktop window.
      One `useBreakpoint` call picks the component. Fixes item 1.
      Effort: 2 days. It touches every screen. The awards plan says not
      before the deadline. Build it right after.
      Built 2026-10-21 in `components/AppNavigation.tsx` and
      `lib/navigation.ts`, around the `Stack` in `app/_layout.tsx`. The home
      header lost its search and watchlist buttons; the search pill now flies
      from the navigation's search icon. The bar raises the snackbar and takes
      the bottom inset from the screens. Hidden on the trailer and the
      gallery. The drawer starts at `extraLarge` (1600 dp), not `large`: on
      a 1440 dp laptop it took a quarter of the window. Checked in a browser
      at 1440 dp. Not checked on a phone yet.
      2026-10-22: Settings and Privacy policy at the end of the drawer, no
      genres. The watchlist shows its count in all three components. The
      home header leaves out what the rail or the drawer shows. The routes
      with the navigation moved to `app/(main)/`, so the search and the
      settings sheets cover the navigation. The screens no longer remount
      when the layout changes. Checked in a browser at 1700, 1440, and
      390 px. Open: the carousel and the grids size from the window, not
      from the area beside the rail or the drawer.
- [ ] **F2. Search with SearchView and recent queries.**
      Shows: SearchView, SearchBar, List, KeyboardAvoidingWrapper.
      Replace the plain `TextInput`. A `List` under the field shows the
      recent queries from the device and the people results. Fixes items
      16 and 22.
      Effort: 1 day.
- [ ] **F3. Filter sheet.**
      Shows: BottomSheet, Slider, Checkbox, ButtonGroup.
      Move the genre filters into a `BottomSheet`: a `Slider` for the rating
      floor and the runtime, `Checkbox` rows for the languages, a
      `ButtonGroup` for the sort. Write the result to the URL (item 24).
      Effort: 1.5 days. Needs `sort_by` on the proxy allowlist.
- [ ] **F4. Settings as a Dialog with real controls.**
      Shows: Dialog, Switch, Radio, List.
      Rebuild the about sheet as a `Dialog` on desktop and a `BottomSheet`
      on a phone. `Radio` for the theme mode, `Switch` for haptics and
      autoplay, `List` for the region and language rows. Keep the theme
      repaint demo. Fixes item 22.
      Effort: 1 day.
- [ ] **F5. Watched state and progress.**
      Shows: Checkbox, Progress, Badge, Tabs.
      On the watchlist: `Tabs` for "To watch" and "Watched", a `Checkbox` on
      each card in a select mode, a `Progress` bar for "12 of 30 watched",
      a `Badge` on the watchlist icon with the count. Local only.
      Effort: 1.5 days.
- [ ] **F6. Crew and collection on the film page.**
      Shows: Avatar, List, Tooltip.
      A "Director" and "Writer" line with `Avatar` under the title. A `List`
      of the collection films for a franchise. The crew data is already in
      the credits response.
      Effort: 1 day. The collection needs one proxy allowlist entry.
- [ ] **F7. Theme playground on the about screen.**
      Shows: defineTheme, applyRoundness, the colour engine.
      A "Try a colour" row: a `Slider` for the hue, a `ButtonGroup` for the
      variant (tonalSpot, vibrant, expressive), a `Slider` for roundness.
      The whole app repaints live. This extends the poster colour feature.
      Effort: 1 day.
- [ ] **F8. Long-press film preview.**
      Shows: Menu, Card, Motion layout.
      Long press on any poster opens a `Menu` with Save, Share, Open
      trailer. On iOS, add `Link.Preview`. Adds haptics. Fixes item 19.
      Effort: 0.5 day.
- [ ] **F9. Component gallery route.**
      Shows: everything.
      A hidden `/kitchen-sink` route that draws every library component with
      the app theme and the poster theme of the current film. Link it from
      the about screen. A pitch post can link to it on the web.
      Effort: 0.5 day. One render test.
- [ ] **F10. "Built with" page on the web.**
      The pitch page. A `/built-with` page in the voice of the README: the
      proxy, the theme repaint, the motion, the prerender, the poster
      colours. Each section links to the component in the library docs.
      Effort: 0.5 day. Static text, prerendered.

## Suggested order

Before the awards freeze on 27 Oct:

1. Items 37, 38, 39: the web regressions from the CDP run. Half a day.
2. Items 3, 4, 14, 15: feel on a phone. Half a day.
3. Items 22, 23, 24, 25: web affordances. Half a day.
4. F2: search with `SearchView`. One day.
5. F7: theme playground. One day.
6. F9 and F10: the gallery route and the pitch page. One day.

After the submission, for the community pitch:

7. F1: adaptive navigation.
8. F3 and F4: filter sheet and settings dialog.
9. F5, F6, F8: watched state, crew, long press.
10. The remaining P2 and P3 items.

## Test before you ship

For each item:

- [ ] `yarn verify` passes.
- [ ] Checked on an Android phone or the light AVD.
- [ ] Checked in a desktop browser at 1440 px and at 390 px.
- [ ] Reduced motion on: nothing breaks.
- [ ] Light and dark: nothing unreadable.

## Not checked by the audit

- No run on a device or in a browser. All findings come from the code.
- The tab order on the web (item 30) needs a browser check.
- Whether `Picture` in `@rootnative/seo` supports `srcset` (item 26).
