import { getLocales } from 'expo-localization'
import { createPreferenceStore } from './preferenceStore'

/**
 * Which country the watch providers are read for.
 *
 * TMDB lists the services per country, so a film on Netflix in India can be
 * on nothing at all in Germany. The app follows the device region until the
 * reader picks one here. A reader who travels, or who uses a VPN, needs the
 * override, and a device that reports no region needs the fallback.
 */

export const STORAGE_KEY = 'reelist.region.v1'

/** The country the app reads when the device reports none. */
const FALLBACK_REGION = 'US'

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

type Region = {
  /** The country the providers are read for. Never empty. */
  code: string
  /** Whether `code` is the reader's own choice rather than the device's. */
  chosen: boolean
  /** Whether the device copy was read. */
  loaded: boolean
}

/**
 * The effective code lives in the snapshot rather than being derived in the
 * hook, so the getter can return the same object until something changes.
 *
 * `serverState`: `deviceRegion()` reads the locale of the machine it runs on,
 * Node at export time and the browser at hydration. The two differ for every
 * reader outside the region of the build machine, so both sides render the
 * fallback, and the device region replaces it right after hydration.
 */
const store = createPreferenceStore<Region>({
  key: STORAGE_KEY,
  initial: () => ({ code: deviceRegion(), chosen: false, loaded: false }),
  parse: ({ code }) => (isCode(code) ? { code, chosen: true } : {}),
  serialize: ({ code, chosen }) => (chosen ? { code } : {}),
  serverState: { code: FALLBACK_REGION, chosen: false, loaded: false },
})

/** Turns the stored string back into a choice. */
export const parseStored = store.parseStored

/** Picks a country. `null` goes back to following the device. */
export function setRegion(code: string | null): void {
  if (code === null) store.choose({ code: deviceRegion(), chosen: false })
  else store.choose({ code, chosen: true })
}

/** The country in use, whether the reader chose it, and whether the copy was read. */
export const useRegion = store.useStore

/** For jest.setup.js, which calls it before each test. */
export const resetRegion = store.reset
