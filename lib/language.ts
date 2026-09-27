import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import { LANGUAGES } from './discover'

/**
 * The language of the films the reader wants first.
 *
 * A reader in India may want Tamil films before Hollywood. TMDB ranks its
 * global lists by popularity, and the global lists are English almost all the
 * way down, so the home screen leads with a row in this language when one is
 * set, and the genre grid starts on it. The text of the app is not affected:
 * this is a content preference, not a locale.
 *
 * A module store rather than a context, for the reason lib/appearance.ts is
 * one: the home screen, the genre screen, and the about screen all read it.
 */

export const STORAGE_KEY = 'reelist.language.v1'

export type Language = {
  /** The ISO 639-1 code of the original language, or null for no preference. */
  code: string | null
  /** Whether the device copy was read. */
  loaded: boolean
}

/** The languages the about screen offers: the same list the genre filter has. */
export const LANGUAGE_OPTIONS = LANGUAGES

const isCode = (value: unknown): value is string =>
  typeof value === 'string' && LANGUAGES.some((l) => l.value === value)

/** The name the app prints for a code, or the code itself for one not listed. */
export const languageName = (code: string): string =>
  LANGUAGES.find((l) => l.value === code)?.label ?? code

/**
 * The snapshot, replaced rather than mutated, for the reason lib/appearance.ts
 * gives: `useSyncExternalStore` compares snapshots by identity.
 */
let state: Language = { code: null, loaded: false }

const listeners = new Set<() => void>()
let touched = false

const emit = () => {
  for (const listener of listeners) listener()
}

const set = (next: Partial<Language>) => {
  state = { ...state, ...next }
  emit()
}

/**
 * Turns the stored string back into a choice. The device copy is not trusted
 * input, for the reason lib/appearance.ts gives. A code the list no longer
 * holds is dropped, so a removed language falls back to no preference rather
 * than a row the menu cannot name.
 */
export function parseStored(raw: string | null): Partial<Language> {
  if (!raw) return {}

  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return {}

    const { code } = value as Record<string, unknown>

    return isCode(code) ? { code } : {}
  } catch {
    return {}
  }
}

const persist = () => {
  // Not awaited, and its failure is not reported, for the reason
  // lib/appearance.ts gives: the screen is already correct.
  const value = state.code ? { code: state.code } : {}
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value)).catch(() => {})
}

const hydrate = async () => {
  let raw: string | null = null
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY)
  } catch {
    // Unreadable storage is no preference. The app stays usable.
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

/** Picks a language. `null` clears the preference. */
export function setLanguage(code: string | null): void {
  touched = true
  set({ code })
  persist()
}

/** The chosen language, or null, and whether the device copy was read. */
export const useLanguage = (): Language =>
  useSyncExternalStore(subscribe, getState, getState)

/**
 * Puts the store back to its start state, for a test. jest.setup.js calls this
 * before each one, because the store lives as long as the process.
 */
export function resetLanguage(): void {
  state = { code: null, loaded: false }
  touched = false
  listeners.clear()
}
