import { Icon } from '@rootnative/components/icon'
import { NavigationDrawer } from '@rootnative/components/navigation-drawer'
import { NavigationRail } from '@rootnative/components/navigation-rail'
import { useSnackbarOffset } from '@rootnative/components/snackbar'
import { Typography } from '@rootnative/components/typography'
import {
  useBreakpoint,
  useThemeMode,
  type IconRenderProps,
  type IconSource,
} from '@rootnative/core'
import { Presence, useMotionValue } from '@rootnative/inertia'
import { useNavigation, usePathname, useRoute, useRouter } from 'expo-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'
import { BrandMark } from './BrandMark'
import {
  FLOATING_BAR_ABOVE_GAP,
  FLOATING_BAR_GAP,
  FLOATING_BAR_HEIGHT,
  FloatingNavigationBar,
} from './FloatingNavigationBar'
import { OfflineBanner } from './OfflineBanner'
import { BarShrinkContext } from '../lib/floatingBar'
import { filmCount } from '../lib/format'
import {
  activeDestination,
  activeDrawerItem,
  DESTINATIONS,
  DRAWER_LINKS,
  navigationHidden,
  navigationKind,
  stackRouteName,
  type Destination,
} from '../lib/navigation'
import { ContentWidthContext } from '../lib/useContentWidth'
import { useHydrating } from '../lib/useHydrating'
import { useKeyboardShrinksWindow } from '../lib/useKeyboardShrinksWindow'
import { useOnline } from '../lib/network'
import { useScreenReader } from '../lib/useScreenReader'
import { useSearchLaunch } from '../lib/useSearchLaunch'
import { useWebKey } from '../lib/useWebKey'
import { isWatched, useWatchlist } from '../lib/watchlist'
import { NAVIGATION_CONTAINER } from '../theme'

/**
 * The tallest bottom inset that holds only a gesture handle: the iOS home
 * indicator (34) or the Android gesture bar (about 24). A taller inset holds
 * the Android three-button bar.
 */
const HANDLE_INSET_MAX = 40

/**
 * The distance from the bottom edge of the window to the floating bar.
 *
 * Over a gesture handle, the bar sits just above the inset, so the handle
 * has its strip to itself and the bar does not sit on the home indicator.
 * A window with no inset keeps the same gap as at the sides. Over a
 * three-button bar, the same gap above the buttons, which must stay clear.
 */
function barBottomFor(insetBottom: number) {
  return insetBottom > HANDLE_INSET_MAX
    ? insetBottom + FLOATING_BAR_GAP
    : Math.max(insetBottom, FLOATING_BAR_GAP)
}

type Item = Omit<Destination, 'icon'> & {
  icon: IconSource
  badge?: number
  accessibilityLabel?: string
}

/**
 * The app's navigation, around every screen of the `(main)` group.
 *
 * One `useBreakpoint` call picks the component: a `FloatingNavigationBar` over
 * the screen on a phone, a `NavigationRail` beside it on a tablet or a laptop,
 * and a standard `NavigationDrawer` beside it on a wide monitor.
 * All three take the same destinations from lib/navigation.ts, and all three
 * light the one the reader is on. The drawer has room for more: at its end it
 * adds the settings and the privacy policy.
 *
 * It wraps the group's `Stack` rather than living in each screen, so a film,
 * a person, or a genre page gets the search and the watchlist without a
 * header of its own for them. The trailer and the gallery are the exception:
 * they fill the window, and the navigation steps out of their way. The search
 * and the settings sheets live in the root stack, above this one, so their
 * scrim covers the navigation too.
 *
 * On the static web export the first paint is the bar, whatever the window:
 * the server renders every page for a 0 wide window, and the breakpoint hooks
 * keep that reading until the page has hydrated. The rail or the drawer
 * arrives on the next frame. See the breakpoints note in the core docs.
 */
export function AppNavigation({ children }: { children: ReactNode }) {
  const { scheme } = useThemeMode()
  const kind = navigationKind(useBreakpoint())
  const pathname = usePathname()
  const router = useRouter()
  const navigation = useNavigation()
  const { key: groupKey } = useRoute()
  const insets = useSafeAreaInsets()

  const hidden = navigationHidden(pathname)
  const active =
    kind === 'drawer' ? activeDrawerItem(pathname) : activeDestination(pathname)
  /**
   * On Android the keyboard shrinks the window, so the bar rose with it and
   * showed through the search sheet's scrim, halfway up the page. It steps
   * aside until the keyboard is down.
   */
  const keyboardUp = useKeyboardShrinksWindow()
  const bar = kind === 'bar' && !hidden && !keyboardUp
  const hydrating = useHydrating()
  // A watched film is done, so the badge counts only the films still to watch.
  const toWatch = useWatchlist().movies.filter((m) => !isWatched(m)).length

  const barBottom = barBottomFor(insets.bottom)

  /**
   * The offline notice floats above the bar on a phone, and at the bottom of
   * the page beside a rail or a drawer. Its text can wrap on a narrow window,
   * so its height is measured, not fixed. The room it takes joins the room of
   * the bar below.
   */
  const offline = !useOnline() && !hidden
  const [noticeHeight, setNoticeHeight] = useState(0)
  const onNoticeLayout = (event: LayoutChangeEvent) =>
    setNoticeHeight(event.nativeEvent.layout.height)
  const noticeRoom = offline
    ? noticeHeight + (bar ? FLOATING_BAR_ABOVE_GAP : FLOATING_BAR_GAP)
    : 0

  /**
   * The snackbar layer draws over the whole window, so on a phone it has to
   * rise above the bar. The layer already adds the bottom inset and its own
   * margin, so the offset is the rest of the room the full bar takes, and the
   * room of the offline notice. Beside the rail and the drawer, only the
   * notice takes room from the bottom edge.
   */
  useSnackbarOffset(
    (bar ? barBottom - insets.bottom + FLOATING_BAR_HEIGHT : 0) + noticeRoom,
  )

  /**
   * The bar and the notice float over the screens, so their content runs
   * under them. The screens pad their lists by `insets.bottom`, so a bottom
   * inset that holds the full bar and the notice lets the last row scroll
   * clear of both. The full bar, not the small one: a list that changed its
   * padding as the bar shrank would jump.
   *
   * The rail pads the left inset, so the screens beside it get none. An app
   * bar pads the side insets itself, and it would clear the cutout twice.
   */
  const rail = kind === 'rail' && !hidden
  const screenInsets = useMemo(() => {
    const bottom = (bar ? barBottom + FLOATING_BAR_HEIGHT : insets.bottom) + noticeRoom
    const left = rail ? 0 : insets.left
    return bottom === insets.bottom && left === insets.left
      ? insets
      : { ...insets, bottom, left }
  }, [bar, rail, barBottom, insets, noticeRoom])

  /**
   * The size the bar moves to, which the screens write as they scroll. See
   * lib/floatingBar.ts. A new page starts with the full bar, whatever the last
   * page left it at. Under a screen reader the bar keeps its full size: the
   * reader moves through the items by swipes, and a label that comes and goes
   * under the focus is confusing.
   */
  const shrink = useMotionValue(0)
  const screenReader = useScreenReader()
  useEffect(() => {
    shrink.set(0)
  }, [pathname, screenReader, shrink])
  const shrinkTarget = bar && !screenReader ? shrink : null

  /**
   * The width the rail or the drawer leaves for the page, for the poster
   * grids. Measured rather than computed from the window, so the grids need
   * no copy of the rail and drawer widths. See lib/useContentWidth.ts.
   */
  const [contentWidth, setContentWidth] = useState<number | null>(null)
  const onContentLayout = (event: LayoutChangeEvent) =>
    setContentWidth(event.nativeEvent.layout.width)

  /**
   * The search sheet opens from its icon: the sheet's field starts as a pill
   * over the box this ref measures and flies to the top of the window. The
   * wrapper goes inside the icon slot, because the items give no ref of their
   * own. See lib/useSearchLaunch.ts.
   */
  const { ref: searchRef, open: openSearch } = useSearchLaunch()
  // `/` opens the search, as on many sites. Not from a field, where it types a
  // slash, and not where the navigation steps aside.
  useWebKey('/', () => void openSearch(), { active: !hidden })
  const items: Item[] = DESTINATIONS.map((d) => {
    if (d.value === 'search') {
      return {
        ...d,
        icon: (props: IconRenderProps) => (
          <View ref={searchRef} collapsable={false}>
            <Icon source={d.icon} {...props} />
          </View>
        ),
      }
    }
    if (d.value === 'watchlist' && toWatch > 0) {
      // The library draws the badge for the eye only, so the label carries
      // the count for a screen reader.
      return {
        ...d,
        badge: toWatch,
        accessibilityLabel: `${d.label}, ${filmCount(toWatch)} to watch`,
      }
    }
    return d
  })

  /**
   * The route names in the group's stack, oldest first, read at press time.
   * `useRoute` leaves the nested state out of the route it returns, so the
   * names come from the root stack, which holds the group's route and the
   * stack inside it.
   */
  const groupHistory = () =>
    navigation
      .getState()
      ?.routes.find((r) => r.key === groupKey)
      ?.state?.routes.map((r) => r.name) ?? []

  /**
   * A destination that is already in the history is returned to with
   * `dismissTo`, so a walk from the home to the watchlist and back does not
   * stack a second home. `navigate` cannot do this: it reuses only the screen
   * on top, and pushes any other. A destination that is not in the history
   * goes on top with `navigate`. The search is the exception: it is a sheet
   * over the screen it was opened from, and the launch hook pushes it after
   * the measurement. A press on the lit destination does nothing.
   */
  const go = (value: string) => {
    if (value === active) return
    if (value === 'search') {
      void openSearch()
      return
    }
    const target = [...DESTINATIONS, ...DRAWER_LINKS].find((d) => d.value === value)
    if (!target) return
    const name = stackRouteName(target.href)
    if (name && groupHistory().includes(name)) router.dismissTo(target.href)
    else router.navigate(target.href)
  }

  /**
   * `''` rather than `undefined` when no destination is lit. An undefined
   * `value` makes the bar uncontrolled, and an uncontrolled bar lights its
   * first item — which would call every film page "Home".
   */
  const value = active ?? ''

  const container = NAVIGATION_CONTAINER[scheme]

  let side: ReactNode = null
  if (rail) {
    side = (
      // The rail runs the full height, so it is the one that clears the
      // status bar on its side of the window, and in landscape the camera
      // cutout on its edge. The insets go on a wrapper: a `paddingTop` on the
      // rail itself replaces the rail's own vertical padding, and on the web,
      // where the inset is 0, the first item then sits cut off at the top
      // edge. The colour goes on the wrapper too, so it runs under both
      // insets.
      <View
        style={{
          paddingTop: insets.top,
          paddingLeft: insets.left,
          backgroundColor: container,
        }}
        testID="app-navigation-rail-frame"
      >
        {/* The rail pads its top by 4 dp only, so without a header the
            first item sits on the window edge. The mark is the header. */}
        <NavigationRail
          items={items}
          value={value}
          onValueChange={go}
          containerColor={container}
          header={
            <View style={styles.railHeader}>
              <BrandMark size={28} />
            </View>
          }
          accessibilityLabel="Main navigation"
          testID="app-navigation-rail"
          style={styles.fill}
        />
      </View>
    )
  } else if (!hidden && kind === 'drawer') {
    side = (
      <NavigationDrawer
        variant="standard"
        value={value}
        onValueChange={go}
        insetTop
        containerColor={container}
        accessibilityLabel="Main navigation"
        testID="app-navigation-drawer"
      >
        <View style={styles.brand}>
          <BrandMark size={28} />
          <Typography variant="titleLarge">Reelist</Typography>
        </View>
        {items.map((d) => (
          <NavigationDrawer.Item
            key={d.value}
            value={d.value}
            label={d.label}
            icon={d.icon}
            selectedIcon={d.selectedIcon}
            badge={d.badge}
            accessibilityLabel={d.accessibilityLabel}
            testID={`app-navigation-drawer-item-${d.value}`}
          />
        ))}
        <NavigationDrawer.Divider />
        {DRAWER_LINKS.map((l) => (
          <NavigationDrawer.Item
            key={l.value}
            value={l.value}
            label={l.label}
            icon={l.icon}
            selectedIcon={l.selectedIcon}
            testID={`app-navigation-drawer-item-${l.value}`}
          />
        ))}
      </NavigationDrawer>
    )
  }

  const notice = (
    <Presence>
      {offline ? <OfflineBanner key="offline" onLayout={onNoticeLayout} /> : null}
    </Presence>
  )

  /*
    One tree for every layout, with the screens always in the same place. A
    change of layout then swaps the navigation only. With a tree for each
    layout, React remounted every screen in the stack at each change: on every
    wide page load of the static site, where the first paint is the bar, and on
    each open of the trailer or the gallery.
  */
  return (
    <View style={[styles.frame, !bar && styles.row]}>
      {side}
      <SafeAreaInsetsContext.Provider value={screenInsets}>
        <ContentWidthContext.Provider value={contentWidth}>
          <BarShrinkContext.Provider value={shrinkTarget}>
            <View
              style={styles.content}
              onLayout={onContentLayout}
              testID="app-navigation-content"
            >
              {children}
              {bar ? null : (
                <View
                  style={[
                    styles.noticeTrack,
                    { bottom: insets.bottom + FLOATING_BAR_GAP },
                  ]}
                >
                  {notice}
                </View>
              )}
            </View>
          </BarShrinkContext.Provider>
        </ContentWidthContext.Provider>
      </SafeAreaInsetsContext.Provider>
      {bar ? (
        // The static site serves the home page as the fallback for a page
        // that is not prerendered, so a cold open of a film on a phone
        // hydrates a bar with "Home" lit, and hydration keeps that attribute
        // over the client's value. The key changes once hydration ends, so
        // React mounts the bar again with the right item lit. See
        // lib/useHydrating.ts. The rail and the drawer mount fresh after the
        // server's bar and need none of this.
        <FloatingNavigationBar
          key={hydrating ? 'hydrating' : 'client'}
          items={items}
          value={value}
          onValueChange={go}
          shrink={shrink}
          containerColor={container}
          bottom={barBottom}
          above={notice}
          accessibilityLabel="Main navigation"
          testID="app-navigation-bar"
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  row: { flexDirection: 'row' },
  content: { flex: 1 },
  // Over the bottom of the page, with the gap of the floating bar. Its empty
  // sides let a touch through to the page.
  noticeTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: FLOATING_BAR_GAP,
    pointerEvents: 'box-none',
  },
  fill: { flex: 1 },
  railHeader: { paddingVertical: 12 },
  // 28 from the edge, where the drawer puts its own section headlines.
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 28,
    paddingVertical: 20,
  },
})
