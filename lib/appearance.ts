import type { ThemeMode } from '@rootnative/core'
import { createPreferenceStore } from './preferenceStore'

/**
 * What the reader chose the app should look like: light, dark, or the system
 * setting. The root layout and the about screen both read it.
 */

export const STORAGE_KEY = 'reelist.appearance.v1'

type Appearance = {
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
 * `readSync`: the scheme guard in app/+html.tsx hides the page from a dark
 * reader until ThemeProvider marks the theme ready, and the provider does that
 * in the effect right before the first read. A synchronous read puts the
 * stored mode on screen in that same flush, before the first paint.
 */
const store = createPreferenceStore<Appearance>({
  key: STORAGE_KEY,
  initial: () => ({ mode: 'system', loaded: false }),
  parse: ({ mode }) => (isMode(mode) ? { mode } : {}),
  serialize: ({ mode }) => ({ mode }),
  readSync: true,
})

/** Turns the stored string back into a choice. */
export const parseStored = store.parseStored

export function setMode(mode: ThemeMode): void {
  store.choose({ mode })
}

/** The chosen mode, and whether the device copy was read. */
export const useAppearance = store.useStore

/** For jest.setup.js, which calls it before each test. */
export const resetAppearance = store.reset
