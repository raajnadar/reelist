import { useRouter } from 'expo-router'
import { useRef } from 'react'
import type { View } from 'react-native'
import { measureWindowRect, setSearchOrigin } from './searchOrigin'

/**
 * Opens the search modal from a button, and tells the modal where the button is.
 *
 * `ref` goes on a View around the button, with `collapsable={false}`: without
 * it Android drops the wrapper from the native tree and there is nothing to
 * measure. `open` goes on the button. See lib/searchOrigin.ts for why the box
 * travels this way.
 *
 * The route is pushed after the measurement, not before. On the web the
 * measurement lands on a later tick, and a modal that mounted first would read
 * an empty store and open with no movement.
 */
export function useSearchLaunch() {
  const router = useRouter()
  const ref = useRef<View>(null)

  const open = async () => {
    const rect = await measureWindowRect(ref.current)
    if (rect) setSearchOrigin(rect)
    router.push('/search')
  }

  return { ref, open }
}
