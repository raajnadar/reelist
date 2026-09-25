import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { STORAGE_KEY, parseStored, setMode, useAppearance } from './appearance'

const stored = async () => JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? 'null')

it('starts by following the system', () => {
  const { result } = renderHook(() => useAppearance())

  expect(result.current.mode).toBe('system')
})

it('keeps a chosen mode on the device', async () => {
  const { result } = renderHook(() => useAppearance())

  act(() => setMode('dark'))

  expect(result.current.mode).toBe('dark')
  await waitFor(async () => expect(await stored()).toEqual({ mode: 'dark' }))
})

it('reads the device copy on the first subscriber', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light' }))

  const { result } = renderHook(() => useAppearance())

  // The default is what the first frame paints, because the read is async.
  expect(result.current.loaded).toBe(false)
  await waitFor(() => expect(result.current.loaded).toBe(true))
  expect(result.current.mode).toBe('light')
})

it('keeps a choice made before the read finishes', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'light' }))

  const { result } = renderHook(() => useAppearance())

  // A fast reader beats the device read. Their press is newer than the stored
  // value and is already written, so the read must not undo it.
  act(() => setMode('dark'))

  await waitFor(() => expect(result.current.loaded).toBe(true))
  expect(result.current.mode).toBe('dark')
})

describe('parseStored', () => {
  it('takes the fields it recognises and nothing else', () => {
    // An older build also wrote a theme preset. The mode must survive it.
    expect(parseStored(JSON.stringify({ preset: 'vhs', mode: 'dark' }))).toEqual({
      mode: 'dark',
    })
  })

  it('drops a mode it does not know', () => {
    expect(parseStored(JSON.stringify({ mode: 'sepia' }))).toEqual({})
  })

  it('returns nothing for a value it cannot use', () => {
    // A half-written string from a process the system killed, and the three
    // other shapes JSON can legally hold.
    expect(parseStored('{"mode":')).toEqual({})
    expect(parseStored('null')).toEqual({})
    expect(parseStored('[1,2]')).toEqual({})
    expect(parseStored(null)).toEqual({})
  })
})
