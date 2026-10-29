import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { mockMovies } from './mock'
import type { MovieDetail } from './types'
import {
  clearWatchlist,
  isSaved,
  isWatched,
  parseStored,
  removeSaved,
  restoreSaved,
  setWatched,
  sortWatchlist,
  STORAGE_KEY,
  toggleSaved,
  useWatchlist,
  type SavedMovie,
} from './watchlist'

const [first, second, third] = mockMovies

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

  it('keeps the watched mark', () => {
    const watched = { ...first, watched: true }

    expect(parseStored(JSON.stringify([watched, second]))).toEqual([watched, second])
  })
})

describe('isWatched', () => {
  it('is true for a film marked watched', () => {
    expect(isWatched({ ...first, watched: true })).toBe(true)
  })

  it('is false for a film from before the mark existed', () => {
    expect(isWatched(first)).toBe(false)
  })

  it('accepts only `true`, because the device copy is not trusted', () => {
    expect(isWatched(JSON.parse(JSON.stringify({ ...first, watched: 'yes' })))).toBe(
      false,
    )
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
      vote_count: 10,
      poster_color: '#1e3a8a',
      cast: [{ id: 1, name: 'A', character: 'B', profile_path: null }],
      trailer: null,
      videos: [],
      recommendations: mockMovies,
      images: [{ file_path: '/still.jpg', aspect_ratio: 1.778 }],
      providers: {},
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

  it('returns the films it removed', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => toggleSaved(first))
    act(() => toggleSaved(second))

    let removed: SavedMovie[] = []
    act(() => {
      removed = clearWatchlist()
    })

    expect(removed).toEqual([second, first])
  })

  it('puts an unsaved film back at its old place', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => toggleSaved(third))
    act(() => toggleSaved(second))
    act(() => toggleSaved(first))

    act(() => toggleSaved(second))
    act(() => restoreSaved([second], 1))

    expect(result.current.movies).toEqual([first, second, third])
    await waitFor(async () =>
      expect(parseStored(await AsyncStorage.getItem(STORAGE_KEY))).toEqual([
        first,
        second,
        third,
      ]),
    )
  })

  it('puts a cleared list back after the films saved since', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => toggleSaved(second))
    act(() => toggleSaved(first))

    let removed: SavedMovie[] = []
    act(() => {
      removed = clearWatchlist()
    })
    // Saved between the clear and the undo, so it is the newest save.
    act(() => toggleSaved(third))
    act(() => restoreSaved(removed))

    expect(result.current.movies).toEqual([third, first, second])
  })

  it('skips a film the reader saved again before the undo', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => toggleSaved(first))

    act(() => toggleSaved(first))
    act(() => toggleSaved(first))
    act(() => restoreSaved([first], 0))

    expect(result.current.movies).toEqual([first])
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

describe('setWatched', () => {
  // Stored newest first, so the list reads first, second, third.
  const saveThree = async () => {
    const hook = renderHook(() => useWatchlist())
    await waitFor(() => expect(hook.result.current.loaded).toBe(true))
    act(() => toggleSaved(third))
    act(() => toggleSaved(second))
    act(() => toggleSaved(first))
    return hook
  }

  it('marks the films watched, and keeps each in its place', async () => {
    const { result } = await saveThree()

    act(() => {
      setWatched([first.id, third.id], true)
    })

    expect(result.current.movies).toEqual([
      { ...first, watched: true },
      second,
      { ...third, watched: true },
    ])
  })

  it('writes the mark to the device', async () => {
    await saveThree()

    act(() => {
      setWatched([second.id], true)
    })

    await waitFor(async () =>
      expect(parseStored(await AsyncStorage.getItem(STORAGE_KEY))).toEqual([
        first,
        { ...second, watched: true },
        third,
      ]),
    )
  })

  it('takes the mark off, and leaves no `watched` key behind', async () => {
    const { result } = await saveThree()
    act(() => {
      setWatched([first.id], true)
    })

    act(() => {
      setWatched([first.id], false)
    })

    // `toStrictEqual`, so a `watched: undefined` left on the film fails.
    expect(result.current.movies[0]).toStrictEqual(first)
  })

  it('returns only the films it changed, so an undo leaves the others alone', async () => {
    const { result } = await saveThree()
    act(() => {
      setWatched([first.id], true)
    })

    let changed: number[] = []
    act(() => {
      // `first` is watched already, and 999 is not saved.
      changed = setWatched([first.id, second.id, 999], true)
    })
    expect(changed).toEqual([second.id])

    act(() => {
      setWatched(changed, false)
    })
    expect(result.current.movies.map(isWatched)).toEqual([true, false, false])
  })

  it('does nothing when no film changes', async () => {
    const { result } = await saveThree()
    const before = result.current.movies

    act(() => {
      setWatched([first.id], false)
    })

    expect(result.current.movies).toBe(before)
  })
})

describe('removeSaved', () => {
  it('removes the films, and returns each with its old place', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => toggleSaved(third))
    act(() => toggleSaved(second))
    act(() => toggleSaved(first))

    let removed: { film: SavedMovie; at: number }[] = []
    act(() => {
      removed = removeSaved([third.id, first.id])
    })

    expect(result.current.movies).toEqual([second])
    // Lowest index first, whatever order the ids came in.
    expect(removed).toEqual([
      { film: first, at: 0 },
      { film: third, at: 2 },
    ])
  })

  it('puts every film back in its old place when the undo restores them in order', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    const fourth = { ...first, id: 104, title: 'Fourth' }
    for (const film of [fourth, third, second, first]) act(() => toggleSaved(film))

    let removed: { film: SavedMovie; at: number }[] = []
    act(() => {
      removed = removeSaved([second.id, fourth.id])
    })
    act(() => {
      for (const { film, at } of removed) restoreSaved([film], at)
    })

    expect(result.current.movies).toEqual([first, second, third, fourth])
  })

  it('keeps the watched mark through a removal and its undo', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => toggleSaved(second))
    act(() => toggleSaved(first))
    act(() => {
      setWatched([first.id], true)
    })

    let removed: { film: SavedMovie; at: number }[] = []
    act(() => {
      removed = removeSaved([first.id])
    })
    act(() => restoreSaved([removed[0].film], removed[0].at))

    expect(result.current.movies).toEqual([{ ...first, watched: true }, second])
  })

  it('returns an empty list and changes nothing for an id that is not saved', async () => {
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    act(() => toggleSaved(first))
    const before = result.current.movies

    let removed: { film: SavedMovie; at: number }[] = []
    act(() => {
      removed = removeSaved([999])
    })

    expect(removed).toEqual([])
    expect(result.current.movies).toBe(before)
  })
})

describe('sortWatchlist', () => {
  const low = { ...first, id: 101, title: 'beta', vote_average: 6 }
  const high = { ...first, id: 102, title: 'Alpha', vote_average: 9 }
  const tie = { ...first, id: 103, title: 'Gamma', vote_average: 6 }
  const saved = [low, high, tie]

  it('keeps the store order for the date added', () => {
    expect(sortWatchlist(saved, 'added')).toBe(saved)
  })

  it('sorts by title without regard to case', () => {
    expect(sortWatchlist(saved, 'title')).toEqual([high, low, tie])
  })

  it('puts the highest rating first, and keeps the date order in a tie', () => {
    expect(sortWatchlist(saved, 'rating')).toEqual([high, low, tie])
  })

  it('does not change the list it is given', () => {
    sortWatchlist(saved, 'title')

    expect(saved).toEqual([low, high, tie])
  })
})
