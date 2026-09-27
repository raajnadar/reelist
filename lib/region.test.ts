import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import {
  STORAGE_KEY,
  deviceRegion,
  parseStored,
  regionName,
  resetRegion,
  setRegion,
  useRegion,
} from './region'

const { getLocales } = jest.requireMock('expo-localization')

const stored = async () => JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? 'null')

describe('deviceRegion', () => {
  it('reads the system region from the first locale', () => {
    getLocales.mockReturnValueOnce([{ languageTag: 'en-IN', regionCode: 'IN' }])

    expect(deviceRegion()).toBe('IN')
  })

  // A plain `en` on the web, or a phone with no region set.
  it('falls back when the device reports no region', () => {
    getLocales.mockReturnValueOnce([{ languageTag: 'en', regionCode: null }])

    expect(deviceRegion()).toBe('US')
  })

  it('upper-cases a code the platform reports in lower case', () => {
    getLocales.mockReturnValueOnce([{ languageTag: 'de-de', regionCode: 'de' }])

    expect(deviceRegion()).toBe('DE')
  })
})

describe('regionName', () => {
  it('names a listed country', () => {
    expect(regionName('IN')).toBe('India')
  })

  // A device in a country the list does not hold still gets its own code.
  it('prints the code for a country that is not listed', () => {
    expect(regionName('IS')).toBe('IS')
  })
})

describe('the store', () => {
  it('starts by following the device', () => {
    const { result } = renderHook(() => useRegion())

    expect(result.current).toMatchObject({ code: 'US', chosen: false })
  })

  it('keeps a chosen country on the device', async () => {
    const { result } = renderHook(() => useRegion())

    act(() => setRegion('IN'))

    expect(result.current).toMatchObject({ code: 'IN', chosen: true })
    await waitFor(async () => expect(await stored()).toEqual({ code: 'IN' }))
  })

  it('goes back to the device region when the choice is cleared', async () => {
    const { result } = renderHook(() => useRegion())

    act(() => setRegion('IN'))
    act(() => setRegion(null))

    expect(result.current).toMatchObject({ code: 'US', chosen: false })
    await waitFor(async () => expect(await stored()).toEqual({}))
  })

  it('reads the device copy on the first subscriber', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 'GB' }))

    const { result } = renderHook(() => useRegion())

    expect(result.current.loaded).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current).toMatchObject({ code: 'GB', chosen: true })
  })

  it('keeps a choice made before the read finishes', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 'GB' }))

    const { result } = renderHook(() => useRegion())

    act(() => setRegion('IN'))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.code).toBe('IN')
  })

  // The device region is read when the store starts, so a test that changes
  // the mocked locale has to restart it.
  it('reads the device region when it starts', () => {
    getLocales.mockReturnValue([{ languageTag: 'fr-FR', regionCode: 'FR' }])
    resetRegion()

    const { result } = renderHook(() => useRegion())

    expect(result.current.code).toBe('FR')
    getLocales.mockReset()
    getLocales.mockReturnValue([{ languageTag: 'en-US', regionCode: 'US' }])
  })
})

describe('parseStored', () => {
  it('takes a valid code and marks it chosen', () => {
    expect(parseStored(JSON.stringify({ code: 'IN' }))).toEqual({
      code: 'IN',
      chosen: true,
    })
  })

  it('ignores a value that is not a two letter code', () => {
    expect(parseStored(JSON.stringify({ code: 'India' }))).toEqual({})
    expect(parseStored(JSON.stringify({ code: 'in' }))).toEqual({})
    expect(parseStored(JSON.stringify({ code: 7 }))).toEqual({})
  })

  it('ignores an empty choice, a bad shape, and bad JSON', () => {
    expect(parseStored(JSON.stringify({}))).toEqual({})
    expect(parseStored('"IN"')).toEqual({})
    expect(parseStored('{not json')).toEqual({})
    expect(parseStored(null)).toEqual({})
  })
})
