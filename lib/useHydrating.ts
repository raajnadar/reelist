import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * Whether this render is part of the HTML of a static web export: on the
 * export server, or in the hydration render that adopts that HTML. React
 * renders once more right after hydration, and from then on this is false.
 * Native and a single-page web build do not hydrate, so it is false there
 * from the first render.
 *
 * Hydration keeps an attribute the server wrote even when the client renders
 * another value: React fixes up text, not attributes. A component whose
 * server state must not survive hydration takes `key={hydrating ? 'server' :
 * 'client'}`, so React mounts it fresh once the client value is in.
 */
export function useHydrating(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  )
}
