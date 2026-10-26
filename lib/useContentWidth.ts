import { useWindowDimensions } from '@rootnative/core'
import { createContext, useContext } from 'react'

/**
 * The width the navigation leaves for a page, as components/AppNavigation.tsx
 * measures it. `null` before the first layout, and outside the navigation.
 */
export const ContentWidthContext = createContext<number | null>(null)

/**
 * The width a page can lay out in: the window minus the rail or the drawer
 * beside it. A poster grid counts its columns from this, not from the
 * window; a grid counted from the window drew its last column under the
 * edge beside a rail.
 *
 * Until the content has laid out it is the window width, which is what the
 * server render and the first client render agree on: `useWindowDimensions`
 * is hydration-safe, and a measurement arrives only after the client mounts.
 * A screen outside the navigation, such as the search sheet over the whole
 * window, gets the window width too.
 */
export function useContentWidth(): number {
  const measured = useContext(ContentWidthContext)
  const { width } = useWindowDimensions()
  return measured ?? width
}
