import { useLocalSearchParams } from 'expo-router'
import { useHydrating } from './useHydrating'

type Params = Record<string, string | string[] | undefined>

/** The names in the query string of the page the browser opened. */
const queryNames = (): string[] =>
  typeof window === 'undefined'
    ? []
    : Array.from(new URLSearchParams(window.location.search).keys())

/**
 * The parameters of the address, for a screen that starts its state from the
 * query string: the query of a search, the filters of a genre, the tab of the
 * watchlist.
 *
 * The static export writes each page with no query string, but the browser
 * hydrates that HTML with the query string of the real address. A screen that
 * read it in the hydration render drew another page than the HTML, and React
 * logged error 418 and rendered the page again. So in the hydration render this
 * leaves out each parameter of the query string. The path parameters stay.
 *
 * `useState` reads its start value once, so the screen must also mount again
 * when hydration ends. See `useAddressKey`.
 */
export function useAddressParams<T extends Params = Params>(): T {
  const params = useLocalSearchParams<T>()
  const hydrating = useHydrating()
  if (!hydrating) return params

  const query = new Set(queryNames())
  return Object.fromEntries(
    Object.entries(params).filter(([name]) => !query.has(name)),
  ) as T
}

/**
 * The key for a screen that reads `useAddressParams`. It changes when
 * hydration ends, so the screen mounts again and starts its state from the
 * real address. It changes only when the address has a query string: a page
 * with none keeps the hydrated tree.
 */
export function useAddressKey(): string {
  const hydrating = useHydrating()
  return hydrating && queryNames().length > 0 ? 'export' : 'address'
}
