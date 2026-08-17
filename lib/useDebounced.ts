import { useEffect, useState } from 'react'

/**
 * The delay between the last keystroke and the request.
 *
 * 350ms is the usual range for a search box: long enough that typing a word
 * does not fire a request per letter, short enough that the wait does not read
 * as lag. It is exported so a test states the same number the app uses rather
 * than repeating a literal that could drift.
 */
export const SEARCH_DEBOUNCE_MS = 350

/**
 * Returns `value` after it stops changing for `delay` milliseconds.
 *
 * The search screen types into state on every keystroke, so the field stays
 * responsive, and fetches from this value instead. Without it, "interstellar"
 * would send twelve requests and the answers could arrive out of order.
 *
 * The timer resets on each change, which is what makes this a debounce rather
 * than a throttle: a fast typist sends one request at the end, not one every
 * `delay`.
 */
export function useDebounced<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    // Clearing on change is the debounce itself. The effect re-runs on every
    // new value, and this cancels the pending timer before the next one starts,
    // so only the last value in a burst ever reaches state.
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
