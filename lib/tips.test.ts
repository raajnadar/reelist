import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import {
  STORAGE_KEY,
  markTipsSeen,
  parseStored,
  tipsFor,
  useTips,
  type TipContext,
} from './tips'

const NATIVE: TipContext = {
  os: 'android',
  linkPreview: false,
  pip: true,
  pipOnHome: true,
}

const ids = (context: TipContext) => tipsFor(context).map((tip) => tip.id)

describe('tipsFor', () => {
  it('gives an Android phone the menu, the small window, and the gestures', () => {
    expect(ids(NATIVE)).toEqual([
      'poster-menu',
      'trailer-window',
      'photo-zoom',
      'carousel-hold',
      'share-note',
    ])
  })

  it('leaves out the small window in a build without the module', () => {
    expect(ids({ ...NATIVE, pip: false })).not.toContain('trailer-window')
  })

  it('names only the button where leaving the app does not start the small window', () => {
    const window = (pipOnHome: boolean) =>
      tipsFor({ ...NATIVE, pipOnHome }).find((tip) => tip.id === 'trailer-window')?.body

    expect(window(true)).toMatch(/Leave the app/)
    expect(window(false)).not.toMatch(/Leave the app/)
  })

  it('gives iOS the preview only where the native view can draw it', () => {
    const ios = { ...NATIVE, os: 'ios' as const }

    expect(ids({ ...ios, linkPreview: true })[0]).toBe('poster-preview')
    // A card in a build without the view is a plain link, with no long press.
    expect(ids(ios)).not.toContain('poster-preview')
    // The small window on iOS is the player's own button, not this app's.
    expect(ids(ios)).not.toContain('trailer-window')
  })

  it('gives the web the keyboard and the pointer, and no gestures', () => {
    expect(ids({ ...NATIVE, os: 'web' })).toEqual([
      'search-key',
      'escape-key',
      'arrow-keys',
      'carousel-hover',
      'share-note',
    ])
  })
})

const stored = async () => JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? 'null')

it('starts unseen, once the device copy is read', async () => {
  const { result } = renderHook(() => useTips())

  // Not loaded on the first frame, so the card waits instead of flashing.
  expect(result.current.loaded).toBe(false)
  await waitFor(() => expect(result.current.loaded).toBe(true))
  expect(result.current.seen).toBe(false)
})

it('keeps the seen state on the device', async () => {
  const { result } = renderHook(() => useTips())

  act(() => markTipsSeen())

  expect(result.current.seen).toBe(true)
  await waitFor(async () => expect(await stored()).toEqual({ seen: true }))
})

it('reads the seen state on the first subscriber', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: true }))

  const { result } = renderHook(() => useTips())

  await waitFor(() => expect(result.current.loaded).toBe(true))
  expect(result.current.seen).toBe(true)
})

describe('parseStored', () => {
  it('returns nothing for a value it cannot use', () => {
    expect(parseStored('{"seen":')).toEqual({})
    expect(parseStored('null')).toEqual({})
    expect(parseStored('[1,2]')).toEqual({})
    expect(parseStored(null)).toEqual({})
  })

  it('takes only a true value as seen', () => {
    expect(parseStored(JSON.stringify({ seen: true }))).toEqual({ seen: true })
    expect(parseStored(JSON.stringify({ seen: 'yes' }))).toEqual({ seen: false })
  })
})
