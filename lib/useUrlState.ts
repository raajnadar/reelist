import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'

export type UrlState = Record<string, string | undefined>

/**
 * Writes a screen's state into the address, so a reload or a shared link
 * keeps it: the filters of a genre, the query of a search, the tab and the
 * order of the watchlist.
 *
 * The screen keeps its state in `useState` and reads the address once, on
 * mount. This hook carries the state the other way. A value of `undefined`
 * takes the parameter out of the address, which is how a cleared filter
 * leaves it. `setParams` replaces the current entry in the history rather
 * than adding one, so the browser back button still leaves the screen.
 *
 * The effect runs when the state changes, not when the address does, so the
 * two cannot chase each other. A parameter the address already has is not
 * written again: a link that carries the filters makes no change on mount.
 */
export function useUrlState(state: UrlState) {
  const router = useRouter()
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  // Effects run in order, so this one is current when the one below reads it.
  const latest = useRef({ params, router, state })
  useEffect(() => {
    latest.current = { params, router, state }
  })

  // An `undefined` must count as a change too, so this is not JSON.stringify.
  const signature = Object.entries(state)
    .map(([name, value]) => `${name}=${value ?? ''}`)
    .join('&')

  useEffect(() => {
    const { params: current, router: target, state: wanted } = latest.current
    const stale = Object.entries(wanted).some(([name, value]) => {
      const present = current[name]
      return (Array.isArray(present) ? present[0] : present) !== value
    })
    if (stale) target.setParams(wanted)
  }, [signature])
}
