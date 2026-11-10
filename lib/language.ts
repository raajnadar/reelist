import { LANGUAGES } from './discover'
import { createPreferenceStore } from './preferenceStore'

/**
 * The language of the films the reader wants first.
 *
 * A reader in India may want Tamil films before Hollywood. TMDB ranks its
 * global lists by popularity, and the global lists are English almost all the
 * way down, so the home screen leads with a row in this language when one is
 * set, and the genre grid starts on it. The text of the app is not affected:
 * this is a content preference, not a locale.
 */

export const STORAGE_KEY = 'reelist.language.v1'

type Language = {
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
 * A code the list no longer holds is dropped, so a removed language falls
 * back to no preference rather than a row the menu cannot name.
 */
const store = createPreferenceStore<Language>({
  key: STORAGE_KEY,
  initial: () => ({ code: null, loaded: false }),
  parse: ({ code }) => (isCode(code) ? { code } : {}),
  serialize: ({ code }) => (code ? { code } : {}),
})

/** Turns the stored string back into a choice. */
export const parseStored = store.parseStored

/** Picks a language. `null` clears the preference. */
export function setLanguage(code: string | null): void {
  store.choose({ code })
}

/** The chosen language, or null, and whether the device copy was read. */
export const useLanguage = store.useStore

/** For jest.setup.js, which calls it before each test. */
export const resetLanguage = store.reset
