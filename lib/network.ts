import {
  addNetworkStateListener,
  getNetworkStateAsync,
  type NetworkState,
} from 'expo-network'
import { useSyncExternalStore } from 'react'

/**
 * Whether a request can be expected to get through. Unknown counts as
 * online: the fields are unset before the first answer, and a request that
 * fails is reported by the screen anyway. Only a definite "no" takes the
 * app offline.
 */
export const isOnline = (state: NetworkState): boolean =>
  state.isConnected !== false && state.isInternetReachable !== false

let online = true
const listeners = new Set<() => void>()
let subscription: { remove: () => void } | null = null

const set = (next: boolean) => {
  if (next === online) return
  online = next
  listeners.forEach((listener) => listener())
}

/**
 * One native subscription for every hook. It starts with the first
 * subscriber and ends with the last, so the app listens only while a screen
 * that cares is mounted. The first answer comes from a read, because the
 * listener reports changes only.
 */
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (listeners.size === 1) {
    subscription = addNetworkStateListener((state) => set(isOnline(state)))
    getNetworkStateAsync()
      .then((state) => set(isOnline(state)))
      .catch(() => {})
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      subscription?.remove()
      subscription = null
    }
  }
}

/**
 * Whether the device has a connection right now.
 *
 * Optimistic: true until the device says otherwise, and always true on the
 * export server, so the static page never carries the offline banner.
 * On the web the answer comes from `navigator.onLine` and the `online` and
 * `offline` events, through expo-network's web module.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => online,
    () => true,
  )
}

/**
 * Calls `listener` with each change of the answer, for code that must act
 * on the change rather than draw it. The subscription is the same one the
 * hook uses.
 */
export function subscribeOnline(listener: (online: boolean) => void): () => void {
  return subscribe(() => listener(online))
}

/** Back to the optimistic start. For tests. */
export function resetNetwork(): void {
  online = true
}
