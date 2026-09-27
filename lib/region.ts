import AsyncStorage from '@react-native-async-storage/async-storage'
import { getLocales } from 'expo-localization'
import { useSyncExternalStore } from 'react'

/**
 * Which country the watch providers are read for.
 *
 * TMDB lists the services per country, so a film on Netflix in India can be
 * on nothing at all in Germany. The app follows the device region until the
 * reader picks one here. A reader who travels, or who uses a VPN, needs the
 * override, and a device that reports no region needs the fallback.
 *
 * A module store rather than a context, for the reason lib/appearance.ts is
 * one: the detail screen and the about screen both read it.
 */

export const STORAGE_KEY = 'reelist.region.v1'

/** The country the app reads when the device reports none. */
export const FALLBACK_REGION = 'US'

export type RegionOption = { code: string; name: string }

/**
 * The countries the about screen offers.
 *
 * TMDB has provider data for about sixty countries, and this list holds the
 * ones with wide service coverage. The device region is offered as well when
 * it is not in the list, so no reader is locked out of their own country. The
 * list is sorted by name, so the menu reads as a directory.
 */
export const REGIONS: readonly RegionOption[] = [
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NO', name: 'Norway' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
]

/** A TMDB region is an ISO 3166-1 alpha-2 code: two capital letters. */
const isCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z]{2}$/.test(value)

/**
 * The country the device reports, or the fallback.
 *
 * `regionCode` is the system region, not the language. A phone set to English
 * in India reports `IN`. It is null on a device with no region set, and on
 * the web it comes from the browser language, which carries no region for a
 * plain `en`.
 */
export const deviceRegion = (): string => {
  const code = getLocales()[0]?.regionCode?.toUpperCase()
  return isCode(code) ? code : FALLBACK_REGION
}

/** The name the app prints for a code, or the code itself for one not listed. */
export const regionName = (code: string): string =>
  REGIONS.find((r) => r.code === code)?.name ?? code

export type Region = {
  /** The country the providers are read for. Never empty. */
  code: string
  /** Whether `code` is the reader's own choice rather than the device's. */
  chosen: boolean
  /** Whether the device copy was read. */
  loaded: boolean
}

/**
 * The snapshot, replaced rather than mutated, for the reason lib/appearance.ts
 * gives: `useSyncExternalStore` compares snapshots by identity. The effective
 * code lives in the snapshot rather than being derived in the hook, so the
 * getter can return the same object until something changes.
 */
let state: Region = { code: deviceRegion(), chosen: false, loaded: false }

const listeners = new Set<() => void>()
let touched = false

const emit = () => {
  for (const listener of listeners) listener()
}

const set = (next: Partial<Region>) => {
  state = { ...state, ...next }
  emit()
}

/**
 * Turns the stored string back into a choice. The device copy is not trusted
 * input, for the reason lib/appearance.ts gives.
 */
export function parseStored(raw: string | null): Partial<Region> {
  if (!raw) return {}

  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return {}

    const { code } = value as Record<string, unknown>

    return isCode(code) ? { code, chosen: true } : {}
  } catch {
    return {}
  }
}

const persist = () => {
  // Not awaited, and its failure is not reported, for the reason
  // lib/appearance.ts gives: the screen is already correct.
  const value = state.chosen ? { code: state.code } : {}
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value)).catch(() => {})
}

const hydrate = async () => {
  let raw: string | null = null
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY)
  } catch {
    // Unreadable storage is the device region. The app stays usable.
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

/** Picks a country. `null` goes back to following the device. */
export function setRegion(code: string | null): void {
  touched = true
  if (code === null) set({ code: deviceRegion(), chosen: false })
  else set({ code, chosen: true })
  persist()
}

/** The country in use, whether the reader chose it, and whether the copy was read. */
export const useRegion = (): Region => useSyncExternalStore(subscribe, getState, getState)

/**
 * Puts the store back to its start state, for a test. jest.setup.js calls this
 * before each one, because the store lives as long as the process.
 */
export function resetRegion(): void {
  state = { code: deviceRegion(), chosen: false, loaded: false }
  touched = false
  listeners.clear()
}
