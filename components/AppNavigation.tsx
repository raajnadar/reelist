import { Icon } from '@rootnative/components/icon'
import { NavigationBar } from '@rootnative/components/navigation-bar'
import { NavigationDrawer } from '@rootnative/components/navigation-drawer'
import { NavigationRail } from '@rootnative/components/navigation-rail'
import { useSnackbarOffset } from '@rootnative/components/snackbar'
import { Typography } from '@rootnative/components/typography'
import {
  useBreakpoint,
  useTheme,
  type IconRenderProps,
  type IconSource,
} from '@rootnative/core'
import { useNavigation, usePathname, useRoute, useRouter } from 'expo-router'
import { useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'
import { BrandMark } from './BrandMark'
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
import { useKeyboardShrinksWindow } from '../lib/useKeyboardShrinksWindow'
import { useSearchLaunch } from '../lib/useSearchLaunch'
import { useWatchlist } from '../lib/watchlist'

/**
 * The MD3 navigation bar height, before the bottom inset the bar adds itself.
 * The library exports no constant for it, and the snackbar needs the number to
 * clear the bar.
 */
const BAR_HEIGHT = 80

type Item = Omit<Destination, 'icon'> & {
  icon: IconSource
  badge?: number
  accessibilityLabel?: string
}

/**
 * The app's navigation, around every screen of the `(main)` group.
 *
 * One `useBreakpoint` call picks the component: a `NavigationBar` under the
 * screen on a phone, a `NavigationRail` beside it on a tablet or a laptop,
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
  const theme = useTheme()
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
  const saved = useWatchlist().movies.length

  /**
   * The snackbar layer draws over the whole window, so on a phone it has to
   * rise above the bar. The layer already adds the bottom inset and its own
   * margin, so the bar's height is the whole offset. Zero on the other
   * layouts: the rail and the drawer take no room from the bottom edge.
   */
  useSnackbarOffset(bar ? BAR_HEIGHT : 0)

  /**
   * The bar takes the bottom inset, so the screens above it no longer sit on
   * the home indicator. They pad their lists by `insets.bottom`, and without
   * this override each list would end with the inset twice.
   */
  const screenInsets = useMemo(
    () => (bar ? { ...insets, bottom: 0 } : insets),
    [bar, insets],
  )

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
    if (d.value === 'watchlist' && saved > 0) {
      // The library draws the badge for the eye only, so the label carries
      // the count for a screen reader.
      const count = saved === 1 ? '1 film' : `${saved} films`
      return { ...d, badge: saved, accessibilityLabel: `${d.label}, ${count}` }
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

  let side: ReactNode = null
  if (!hidden && kind === 'rail') {
    side = (
      // The rail runs the full height, so it is the one that clears the
      // status bar on its side of the window. The inset goes on a wrapper:
      // a `paddingTop` on the rail itself replaces the rail's own vertical
      // padding, and on the web, where the inset is 0, the first item then
      // sits cut off at the top edge.
      <View style={{ paddingTop: insets.top }}>
        {/* The rail pads its top by 4 dp only, so without a header the
            first item sits on the window edge. The mark is the header. */}
        <NavigationRail
          items={items}
          value={value}
          onValueChange={go}
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
        accessibilityLabel="Main navigation"
        testID="app-navigation-drawer"
        style={[styles.drawer, { borderColor: theme.colors.outlineVariant }]}
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
          <View
            style={styles.content}
            onLayout={onContentLayout}
            testID="app-navigation-content"
          >
            {children}
          </View>
        </ContentWidthContext.Provider>
      </SafeAreaInsetsContext.Provider>
      {bar ? (
        <NavigationBar
          items={items}
          value={value}
          onValueChange={go}
          insetBottom
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
  fill: { flex: 1 },
  railHeader: { paddingVertical: 12 },
  // A standard drawer shares the surface colour with the page, so one hairline
  // is what separates the two.
  drawer: { borderRightWidth: StyleSheet.hairlineWidth },
  // 28 from the edge, where the drawer puts its own section headlines.
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 28,
    paddingVertical: 20,
  },
})
