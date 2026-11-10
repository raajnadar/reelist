import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'

type Options<S extends { loaded: boolean }> = {
  /** The AsyncStorage key. Versioned, so a new shape can start clean. */
  key: string
  /** The state before the device copy is read. A function, so it can read the device. */
  initial: () => S
  /** The fields of a stored object worth keeping. The object itself is already checked. */
  parse: (stored: Record<string, unknown>) => Partial<S>
  /** What goes to the device. */
  serialize: (state: S) => Record<string, unknown>
  /**
   * The snapshot of the static export and of the first client render, for a
   * store whose start state differs between the build machine and the
   * browser. Without it React reports a hydration error where the state is
   * text.
   */
  serverState?: S
  /**
   * On the web, AsyncStorage is localStorage, so the copy can be read in the
   * same tick as the first subscriber, and the stored value is on screen
   * before the first paint. An asynchronous read shows the start state for a
   * frame first. Worth it for a look, not for content.
   */
  readSync?: boolean
}

/**
 * A preference the reader set, held for the life of the process and copied to
 * the device: the appearance, the language, the region, and the tips.
 *
 * A module store rather than a context, because the root layout reads some of
 * them, and the root layout sits above any provider a screen could add.
 *
 * The snapshot is replaced rather than mutated. `useSyncExternalStore`
 * compares snapshots by identity, so a getter that built a fresh object on
 * every call would never return an equal value and would loop.
 *
 * The device copy is read once, when the first component subscribes. It is
 * not trusted input: it can be half written, or left by an older version of
 * this app with fields this one does not read. A choice the reader made while
 * the read was in flight outranks the stored one: it is newer, and `persist`
 * already wrote it.
 */
export function createPreferenceStore<S extends { loaded: boolean }>(
  options: Options<S>,
) {
  let state = options.initial()
  let touched = false
  const listeners = new Set<() => void>()

  const set = (next: Partial<S>) => {
    state = { ...state, ...next }
    for (const listener of listeners) listener()
  }

  const parseStored = (raw: string | null): Partial<S> => {
    if (!raw) return {}
    try {
      const value: unknown = JSON.parse(raw)
      if (typeof value !== 'object' || value === null) return {}
      return options.parse(value as Record<string, unknown>)
    } catch {
      return {}
    }
  }

  const applyStored = (raw: string | null) =>
    set({ ...(touched ? {} : parseStored(raw)), loaded: true } as Partial<S>)

  const readStoredSync = (): boolean => {
    if (!options.readSync || Platform.OS !== 'web' || typeof window === 'undefined') {
      return false
    }
    try {
      applyStored(window.localStorage.getItem(options.key))
      return true
    } catch {
      return false
    }
  }

  const hydrate = async () => {
    if (readStoredSync()) return
    let raw: string | null = null
    try {
      raw = await AsyncStorage.getItem(options.key)
    } catch {
      // Unreadable storage is the start state. The app stays usable.
    }
    applyStored(raw)
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    if (!state.loaded && listeners.size === 1) void hydrate()
    return () => {
      listeners.delete(listener)
    }
  }

  const getState = () => state
  const getServerState = () => options.serverState ?? state

  /**
   * The reader's choice. Not awaited, and a failed write is not reported: the
   * screen is already correct, and a browser in private mode costs them the
   * choice on the next launch, which no message could offer an action for.
   */
  const choose = (next: Partial<S>) => {
    touched = true
    set(next)
    void AsyncStorage.setItem(
      options.key,
      JSON.stringify(options.serialize(state)),
    ).catch(() => {})
  }

  const useStore = (): S => useSyncExternalStore(subscribe, getState, getServerState)

  /** Back to the start state, for a test. The store lives as long as the process. */
  const reset = () => {
    state = options.initial()
    touched = false
    listeners.clear()
  }

  return { getState, choose, parseStored, useStore, reset }
}
