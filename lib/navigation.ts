import type { Breakpoint } from '@rootnative/core'
import type { Href } from 'expo-router'

/**
 * One place the reader can reach from every screen.
 *
 * The shape is the library's `NavigationBarItem` plus the route it opens, so
 * one array feeds the bar, the rail, and the drawer. `icon` is the outlined
 * resting glyph and `selectedIcon` its filled pair, as MD3 draws them.
 */
export type Destination = {
  value: 'home' | 'search' | 'watchlist'
  label: string
  icon: string
  selectedIcon: string
  href: Href
}

export const DESTINATIONS: Destination[] = [
  { value: 'home', label: 'Home', icon: 'home-outline', selectedIcon: 'home', href: '/' },
  {
    value: 'search',
    label: 'Search',
    icon: 'magnify',
    selectedIcon: 'magnify',
    href: '/search',
  },
  {
    value: 'watchlist',
    label: 'Watchlist',
    icon: 'bookmark-outline',
    selectedIcon: 'bookmark',
    href: '/watchlist',
  },
]

/**
 * The links at the end of the drawer. The bar and the rail keep to the three
 * destinations, so there the settings stay in the home header, and the
 * privacy policy in the settings.
 */
export type DrawerLink = {
  value: 'settings' | 'privacy'
  label: string
  icon: string
  selectedIcon: string
  href: Href
}

export const DRAWER_LINKS: DrawerLink[] = [
  {
    value: 'settings',
    label: 'Settings',
    icon: 'cog-outline',
    selectedIcon: 'cog',
    href: '/about',
  },
  {
    value: 'privacy',
    label: 'Privacy policy',
    icon: 'shield-lock-outline',
    selectedIcon: 'shield-lock',
    href: '/privacy',
  },
]

/** The component that carries the destinations at one window size. */
export type NavigationKind = 'bar' | 'rail' | 'drawer'

/**
 * The window size class and the navigation component that carries the
 * destinations: a bar along the bottom of a phone, a rail down the side of a
 * tablet and a laptop, and a permanent drawer on a wide monitor.
 *
 * MD3 allows the drawer from `large` (1200 dp). The rail stays until
 * `extraLarge` here: a 13 inch laptop is 1440 dp wide, and a 360 dp panel
 * takes a quarter of it from the film rows for three destinations.
 */
export function navigationKind(breakpoint: Breakpoint): NavigationKind {
  switch (breakpoint) {
    case 'compact':
      return 'bar'
    case 'extraLarge':
      return 'drawer'
    default:
      return 'rail'
  }
}

/**
 * The destination the reader is on, or undefined on a screen that is none of
 * them. A film, a person, or a genre page lights no destination: it can be
 * reached from the home and from the watchlist alike, and the one it came
 * from is not known here.
 */
export function activeDestination(pathname: string): Destination['value'] | undefined {
  return DESTINATIONS.find((d) => d.href === pathname)?.value
}

/**
 * The drawer item the reader is on. The drawer holds more than the three
 * destinations, so the settings and the privacy policy light an item of their
 * own there.
 */
export function activeDrawerItem(pathname: string): string | undefined {
  return (
    activeDestination(pathname) ?? DRAWER_LINKS.find((l) => l.href === pathname)?.value
  )
}

/**
 * The name the `(main)` stack gives the page an href opens: its file name
 * under app/(main), so `/` is `index`. The destinations and the drawer links
 * are static paths, so the rest of the path is the name.
 */
export function stackRouteName(href: Href): string | undefined {
  if (typeof href !== 'string') return undefined
  return href === '/' ? 'index' : href.slice(1)
}

/**
 * The routes that fill the window with one picture or one video. A bar under
 * a photo, or a rail beside a trailer, would take room from the one thing the
 * screen shows.
 */
const IMMERSIVE_ROUTES = ['/trailer/', '/gallery/']

export function navigationHidden(pathname: string): boolean {
  return IMMERSIVE_ROUTES.some((prefix) => pathname.startsWith(prefix))
}
