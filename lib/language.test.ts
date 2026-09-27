import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import {
  STORAGE_KEY,
  languageName,
  parseStored,
  setLanguage,
  useLanguage,
} from './language'

const stored = async () => JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? 'null')

describe('languageName', () => {
  it('names a listed language', () => {
    expect(languageName('ta')).toBe('Tamil')
  })

  it('prints the code for a language that is not listed', () => {
    expect(languageName('xx')).toBe('xx')
  })
})

describe('the store', () => {
  it('starts with no preference', () => {
    const { result } = renderHook(() => useLanguage())

    expect(result.current.code).toBeNull()
  })

  it('keeps a chosen language on the device', async () => {
    const { result } = renderHook(() => useLanguage())

    act(() => setLanguage('ta'))

    expect(result.current.code).toBe('ta')
    await waitFor(async () => expect(await stored()).toEqual({ code: 'ta' }))
  })

  it('clears the preference', async () => {
    const { result } = renderHook(() => useLanguage())

    act(() => setLanguage('ta'))
    act(() => setLanguage(null))

    expect(result.current.code).toBeNull()
    await waitFor(async () => expect(await stored()).toEqual({}))
  })

  it('reads the device copy on the first subscriber', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 'hi' }))

    const { result } = renderHook(() => useLanguage())

    expect(result.current.loaded).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.code).toBe('hi')
  })

  it('keeps a choice made before the read finishes', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 'hi' }))

    const { result } = renderHook(() => useLanguage())

    act(() => setLanguage('ta'))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.code).toBe('ta')
  })
})

describe('parseStored', () => {
  it('takes a listed code', () => {
    expect(parseStored(JSON.stringify({ code: 'ta' }))).toEqual({ code: 'ta' })
  })

  // A language removed from the list falls back to no preference rather than
  // a row the menu cannot name.
  it('ignores a code the list does not hold', () => {
    expect(parseStored(JSON.stringify({ code: 'xx' }))).toEqual({})
    expect(parseStored(JSON.stringify({ code: 7 }))).toEqual({})
  })

  it('ignores an empty choice, a bad shape, and bad JSON', () => {
    expect(parseStored(JSON.stringify({}))).toEqual({})
    expect(parseStored('"ta"')).toEqual({})
    expect(parseStored('{not json')).toEqual({})
    expect(parseStored(null)).toEqual({})
  })
})
