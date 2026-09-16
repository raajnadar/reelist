import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { mockMovies } from './mock'
import type { MovieDetail } from './types'
import {
  clearWatchlist,
  isSaved,
  parseStored,
  STORAGE_KEY,
  toggleSaved,
  useWatchlist,
} from './watchlist'

const [first, second] = mockMovies

describe('parseStored', () => {
  it('reads back what the store wrote', () => {
    expect(parseStored(JSON.stringify([first]))).toEqual([first])
  })

  it('treats an absent value as an empty list', () => {
    expect(parseStored(null)).toEqual([])
  })

  it('treats a string that is not JSON as an empty list', () => {
    // A process the system killed mid-write leaves exactly this.
    expect(parseStored('[{"id":1')).toEqual([])
  })

  it('ignores a stored value that is not a list', () => {
    expect(parseStored('{"id":1}')).toEqual([])
  })

  it('drops an entry with no numeric id', () => {
    // A film with no id would reach FlatList as a child with no key.
    const raw = JSON.stringify([first, { title: 'No id' }, { id: '7' }])

    expect(parseStored(raw)).toEqual([first])
  })
})

describe('isSaved', () => {
  it('finds a film by id, not by identity', () => {
    // The stored copy is parsed from JSON, so it is never the same object as
    // the one the detail screen holds.
    expect(isSaved([{ ...first }], first.id)).toBe(true)
  })

  it('is false for a film that is not in the list', () => {
    expect(isSaved([first], second.id)).toBe(false)
  })
})

describe('useWatchlist', () => {
  it('starts empty and unread, then reports the device copy', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([first]))

    const { result } = renderHook(() => useWatchlist())

    // `loaded` false is what keeps the watchlist screen from announcing an
    // empty list before the device has answered.
    expect(result.current).toEqual({ movies: [], loaded: false })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.movies).toEqual([first])
  })

  it('stores the card fields only', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    // What the detail screen holds: a MovieDetail, with the cast, the videos,
    // and twenty recommended films on it. None of that belongs on the device.
    const detail: MovieDetail = {
      ...first,
      genres: [{ id: 28, name: 'Action' }],
      runtime: 130,
      tagline: 'A tagline',
      cast: [{ id: 1, name: 'A', character: 'B', profile_path: null }],
      trailer: null,
      recommendations: mockMovies,
    }

    act(() => toggleSaved(detail))

    expect(result.current.movies).toEqual([first])
  })

  it('adds a film to the front', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => toggleSaved(first))
    act(() => toggleSaved(second))

    // Newest first: a watchlist is read from the top.
    expect(result.current.movies).toEqual([second, first])
  })

  it('removes a film that is already saved', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => toggleSaved(first))
    act(() => toggleSaved(first))

    expect(result.current.movies).toEqual([])
  })

  it('writes every change to the device', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => toggleSaved(first))

    await waitFor(async () =>
      expect(parseStored(await AsyncStorage.getItem(STORAGE_KEY))).toEqual([first]),
    )
  })

  it('keeps a film saved before the device answered', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([second]))

    const { result } = renderHook(() => useWatchlist())
    // Saved while the read is still in flight. The stored copy is older, so it
    // must not replace this.
    act(() => toggleSaved(first))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.movies).toEqual([first])
  })

  it('empties the list', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => toggleSaved(first))

    act(() => clearWatchlist())

    expect(result.current.movies).toEqual([])
    await waitFor(async () => expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('[]'))
  })

  it('reports one change to every reader', async () => {
    const a = renderHook(() => useWatchlist())
    const b = renderHook(() => useWatchlist())
    await waitFor(() => expect(a.result.current.loaded).toBe(true))

    act(() => toggleSaved(first))

    // The detail screen and the watchlist screen are both mounted while a
    // saved film is opened from the grid.
    expect(a.result.current.movies).toEqual([first])
    expect(b.result.current.movies).toEqual([first])
  })

  it('reads the device once, however many readers there are', async () => {
    const getItem = AsyncStorage.getItem as jest.Mock
    getItem.mockClear()

    const a = renderHook(() => useWatchlist())
    renderHook(() => useWatchlist())
    await waitFor(() => expect(a.result.current.loaded).toBe(true))

    expect(getItem).toHaveBeenCalledTimes(1)
  })

  it('survives storage that cannot be read', async () => {
    const getItem = AsyncStorage.getItem as jest.Mock
    // A browser in private mode, or a device with no space left.
    getItem.mockRejectedValueOnce(new Error('unavailable'))

    const { result } = renderHook(() => useWatchlist())

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.movies).toEqual([])
  })
})
