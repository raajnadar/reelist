import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ThemeMode } from '@rootnative/core'
import { useSyncExternalStore } from 'react'

/**
 * What the reader chose the app should look like: light, dark, or the system
 * setting.
 *
 * A module store rather than a context, for the reason lib/watchlist.ts is
 * one: the root layout and the about screen both read it, and the root layout
 * sits above any provider the about screen could add.
 */

export const STORAGE_KEY = 'reelist.appearance.v1'

export type Appearance = {
  mode: ThemeMode
  /**
   * Whether the device copy was read.
   *
   * Nothing gates on it today — the app paints the system mode and swaps to
   * the stored one a frame later, which is the right trade for a look rather
   * than for content.
   */
  loaded: boolean
}

const MODES: readonly ThemeMode[] = ['system', 'light', 'dark']

const isMode = (value: unknown): value is ThemeMode => MODES.includes(value as ThemeMode)

/**
 * The snapshot, replaced rather than mutated.
 *
 * `useSyncExternalStore` compares snapshots by identity, so a getter that built
 * a fresh object on every call would never return an equal value and would
 * loop. Replacing the object only when something changes lets one hook call
 * carry both fields.
 */
let state: Appearance = { mode: 'system', loaded: false }

const listeners = new Set<() => void>()
let touched = false

const emit = () => {
  for (const listener of listeners) listener()
}

const set = (next: Partial<Appearance>) => {
  state = { ...state, ...next }
  emit()
}

/**
 * Turns the stored string back into a choice.
 *
 * The device copy is not trusted input: it can be half written, or left by an
 * older version of this app with fields this one does not read.
 */
export function parseStored(raw: string | null): Partial<Appearance> {
  if (!raw) return {}

  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return {}

    const { mode } = value as Record<string, unknown>

    return isMode(mode) ? { mode } : {}
  } catch {
    return {}
  }
}

const persist = () => {
  // Not awaited, and its failure is not reported. The look the reader sees is
  // already correct; a browser in private mode costs them the choice on the
  // next launch, and no message could offer an action for that.
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: state.mode })).catch(
    () => {},
  )
}

/**
 * Reads the device copy, once, when the first component subscribes.
 *
 * A choice the reader made while this read was in flight outranks the stored
 * one: it is newer, and `persist` already wrote it.
 */
const hydrate = async () => {
  let raw: string | null = null
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY)
  } catch {
    // Unreadable storage is the default look. The app stays usable.
  }

  set({ ...(touched ? {} : parseStored(raw)), loaded: true })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (!state.loaded && listeners.size === 1) void hydrate()
  return () => {
    listeners.delete(listener)
  }
}

const getState = () => state

export function setMode(mode: ThemeMode): void {
  touched = true
  set({ mode })
  persist()
}

/** The chosen mode, and whether the device copy was read. */
export const useAppearance = (): Appearance =>
  useSyncExternalStore(subscribe, getState, getState)

/**
 * Puts the store back to its start state, for a test. jest.setup.js calls this
 * before each one, because the store lives as long as the process.
 */
export function resetAppearance(): void {
  state = { mode: 'system', loaded: false }
  touched = false
  listeners.clear()
}
