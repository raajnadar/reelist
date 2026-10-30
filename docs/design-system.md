# Built with RootNative UI

[RootNative UI](https://rootnative.github.io/ui/) draws every part of Reelist.
This page explains how the app uses it: the settings sheet, the themes, the film
colours, the motion, the navigation, and the button sizes.

- [The settings sheet](#the-settings-sheet)
  - [It is a modal, drawn by the app](#it-is-a-modal-drawn-by-the-app)
- [Light and dark](#light-and-dark)
- [Each film in its own colours](#each-film-in-its-own-colours)
- [Motion is a vocabulary, not a number](#motion-is-a-vocabulary-not-a-number)
- [Navigation that fits the window](#navigation-that-fits-the-window)
- [One button size for each role](#one-button-size-for-each-role)
- [The package links and versions](#the-package-links-and-versions)

## The settings sheet

The settings sheet, at [app/about.tsx](../app/about.tsx), opens from the settings
button in the home header. The light and dark control comes first. Below it, a
short "about" part names [RootNative UI](https://rootnative.github.io/ui/), the
three packages that draw the app, and the version of each one.

### It is a modal, drawn by the app

The screen is a detour, not a place: the reader opens it, changes the look, and
returns to the film they were on. It has to keep the screen underneath on
display while the theme repaints it, because that repaint is the one thing the
screen exists to show.

`app/_layout.tsx` gives the route two options and nothing else:

```tsx
<Stack.Screen name="about" options={{ presentation: 'transparentModal', animation: 'fade' }} />
```

`transparentModal` is plain React Navigation, and it behaves the same on all
three platforms. The navigator keeps the screen below mounted and visible
whenever the screen above it is a transparent presentation, and hands this route
a see-through background:

```js
// react-navigation/native-stack/views/NativeStackView.js
const TRANSPARENT_PRESENTATIONS = ['transparentModal', 'containedTransparentModal']
display: (isFocused || TRANSPARENT_PRESENTATIONS.includes(nextPresentation)) ? 'flex' : 'none'
```

Everything the reader sees is then drawn by `app/about.tsx` — a scrim, and a
card over it. That is the point rather than extra work: the card's colours and
its corner (`theme.shape.cornerExtraLarge`) come from the theme, so **a change
to light or dark repaints the card that made the change**. A presentation owned
by the navigator could not do that.

`useBreakpoint()` picks the shape. Below the `compact` boundary the card fills
the window and drops its corner, because a centred card with margins is a worse
full-screen page. Above it the card is 640 px wide and at most 86% of the window
tall, centred on the scrim. A press on the scrim dismisses; the scrim itself is
out of the accessibility tree, because it repeats what the close button already
offers.

**The path not taken.** `presentation: 'modal'` gives a native sheet on iOS and
Android, and Expo Router has a web implementation with a centred desktop dialog
— but only behind `EXPO_UNSTABLE_WEB_MODAL`. Without the flag Metro resolves
`expo-router/build/layouts/_web-modal.js` to the plain stack and the route draws
as a full page. That meant an unstable flag in three npm scripts, a local type
for a `webModalStyle` option the package does not export, and a look the theme
could not reach. `transparentModal` costs about forty lines of ordinary layout
and has none of that.

## Light and dark

The reader picks System, Light, or Dark. The choice goes to
[lib/appearance.ts](../lib/appearance.ts), the root layout reads it, and the film
rows behind the sheet repaint with it. The choice is kept on the device.

The two themes come from one call in [theme.ts](../theme.ts):
`createMaterialTheme('#BE123C')`. The HCT colour engine behind
`@rootnative/core/create-theme` derives all 49 MD3 roles from that seed, for
light and for dark.

## Each film in its own colours

A film page takes its theme from the main colour of its poster. The proxy
calculates the colour once for each poster (see
[proxy/README.md](../proxy/README.md#the-poster-colour)), and `getMovie` returns
the film with its colour, so the page draws in the film colours from its first
frame and does not repaint. The prerendered web pages carry the colour in
their HTML.

[components/FilmTheme.tsx](../components/FilmTheme.tsx) puts a second
`ThemeProvider` around the film page, with a theme from
`createMaterialTheme(colour)`. The second provider takes the mode and the icon
resolver from the root one, so the light or dark choice still applies to the
film page, and the icons still draw. A film with no usable colour keeps the app
theme.

The MD3 roles keep their contrast whatever the seed is. A check of 40 posters
in four scheme variants, light and dark, found no text pair under 4.5:1.

## Motion is a vocabulary, not a number

[lib/motion.ts](../lib/motion.ts) registers six named transitions once, on
`<MotionConfig>` at the app root. No component in the app writes a spring
constant; each writes `transition="press"` or `transition="enter"`, and the feel
of every surface changes from that one file.

A TypeScript module augmentation in that file narrows the `transition` prop to
the six names, so a typo is a compile error rather than a dev-time warning and a
silent fallback to the default spring.

Reduced motion is handled once, in the same place: `<MotionConfig>` defaults to
`reducedMotion="user"`, and every animation below it downgrades to no animation
when the OS asks.

## Navigation that fits the window

[components/AppNavigation.tsx](../components/AppNavigation.tsx) wraps every
page in the `(main)` route group. One `useBreakpoint()` call picks the
component, and all three take the same three destinations from
[lib/navigation.ts](../lib/navigation.ts):

| Window class                  | Width         | Component                    |
| ----------------------------- | ------------- | ---------------------------- |
| `compact`                     | under 600 dp  | `NavigationBar`, below       |
| `medium`, `expanded`, `large` | 600 to 1599   | `NavigationRail`, beside     |
| `extraLarge`                  | 1600 and over | `NavigationDrawer`, standard |

MD3 allows the drawer from `large` (1200 dp). The rail stays until `extraLarge`
here: a 13 inch laptop is 1440 dp wide, and a 360 dp panel takes a quarter of
it from the film rows for three destinations.

The drawer has room for more than the three destinations. At its end it has the
settings and the privacy policy. The home header leaves out what the navigation
beside it shows: next to the rail it has no mark, and next to the drawer it has
no mark, no name, and no settings button. The name stays the page's `<h1>` for
a screen reader.

The watchlist shows the count of films still to watch in all three components:
a watched film is done, so it does not count. The bar
and the rail draw a badge on the icon, and the drawer puts the number at the end
of the row. The label holds the count too, for a screen reader.

The navigation lights the destination the reader is on. A film, a person, or a
genre page lights none: it can be reached from the home and from the watchlist
alike. The trailer and the gallery fill the window, so the navigation steps out
of their way on those two routes.

The search and the settings sheets are not in the group. They live in the root
stack, above it, so their scrim covers the navigation as well as the page, and
they centre on the window. The root layout draws no `<main>`: the group's layout
draws it inside the navigation, and
[lib/useRootScreenRole.ts](../lib/useRootScreenRole.ts) gives a sheet that has no
page below it, on a deep link, its own. A group name is part of the route key,
so the prerendered data of the home is under `/(main)/index`.

The navigation keeps one tree for every layout, with the screens in the same
place. A change from the bar to the rail swaps the navigation only. It does not
remount the screens, and on a wide window the static site makes that change on
every load.

A press on Search measures the icon and opens the sheet from it, the same way
the home header button did before. The bar on a phone also takes the bottom
inset, and raises the snackbar above itself with `useSnackbarOffset`, so a
"Saved" notice never lands under it.

On the web, `/` opens the search from any page that shows the navigation, and
Escape closes the search, the settings, and the trailer.
[lib/useWebKey.ts](../lib/useWebKey.ts) listens on `window` while its screen is on
top, so an open menu takes Escape first and one press closes one layer. A key
typed in a field stays in the field. A React Native `TextInput` on the web stops
each key it gets, so the search field reads Escape from its own `onKeyPress`.

On the static web export the first paint is always the bar: the server renders
each page for a 0 wide window, and the breakpoint hook keeps that reading until
the page has hydrated. The rail or the drawer arrives one frame later.

## One button size for each role

[lib/buttonSize.ts](../lib/buttonSize.ts) gives each kind of button one size, the
same way `lib/motion.ts` names each transition:

| Role     | Size     | Height | Where                                                    |
| -------- | -------- | ------ | -------------------------------------------------------- |
| `inline` | `small`  | 40 dp  | Film actions, share, "Show more", the about screen links |
| `state`  | `medium` | 56 dp  | The one action of an empty or failed screen              |

A screen writes `size={BUTTON_SIZE.inline}`. ESLint rejects a literal size on a
`Button`, so a new button cannot drift from the table. The Button pads its touch
area to 48 dp on iOS and Android, so a 40 dp button is still large enough to
touch.

## The package links and versions

The settings sheet links to each package it names. Each package name opens that
package's repository, and the URL is read from the package's own `homepage`
field rather than written into the screen, so a package that moves takes its
link with it.

The version beside each name comes from the same place — the package's own
`version` field, read at runtime. All three packages publish `./package.json`
in their exports, so the screen states what is installed and a `yarn upgrade`
cannot leave it behind. A test compares the number on screen
against the number installed, so an upgrade that left the page behind fails the
build.
