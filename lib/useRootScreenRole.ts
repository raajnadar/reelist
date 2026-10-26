import { useNavigationState, useRoute } from 'expo-router/react-navigation'

/**
 * The landmark role for a screen in the root stack, outside the `(main)`
 * group: the search and the settings sheets, and the page for an unknown
 * address.
 *
 * Opened over a page, such a screen takes no landmark: the page below holds
 * the one `<main>`, which app/(main)/_layout.tsx draws. As the first screen,
 * on a deep link and in the static export, nothing below it has a `<main>`,
 * and `rootnative-seo audit` fails a page with none.
 *
 * Read from the stack state, not from `router.canGoBack()`: that call asks
 * `navigation.isFocused()`, which is stale during a render and warns in
 * development. The server render and the first client render build the same
 * state from the address, so they agree.
 */
export function useRootScreenRole(): 'main' | undefined {
  const { key } = useRoute()
  const first = useNavigationState((state) => state.routes[0]?.key === key)
  return first ? 'main' : undefined
}
