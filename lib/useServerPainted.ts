import { useState } from 'react'
import { useHydrating } from './useHydrating'

/**
 * Whether this component first rendered as part of the HTML of a static web
 * export: on the export server, or in the hydration render that adopts that
 * HTML.
 *
 * The browser paints that HTML before the bundle runs. An entrance that
 * starts at `opacity: 0` is written into the HTML at that value, so the
 * reader sees an empty page until hydration ends, which is seconds on a
 * phone. A server-painted element is already on the screen and must show at
 * rest: pass `initial={painted ? false : { ... }}`. Content that arrives
 * later, after a request or a navigation, keeps its entrance.
 *
 * The answer is fixed at mount. React renders again after hydration with the
 * client value, and `Motion.*` reads `initial` on mount only. Native and a
 * single-page web build do not hydrate, so the answer there is false.
 */
export function useServerPainted(): boolean {
  const hydrating = useHydrating()
  const [painted] = useState(hydrating)

  return painted
}
