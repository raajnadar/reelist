import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { Platform, Share } from 'react-native'
import { haptic } from '../lib/haptics'
import { mockMovieDetail } from '../lib/mock'
import { readCache } from '../lib/resourceCache'
import { renderWithProviders } from '../lib/test-utils'
import type { Movie } from '../lib/types'
import { isWatched, setWatched, toggleSaved, useWatchlist } from '../lib/watchlist'
import { MovieCard } from './MovieCard'

const mockPush = jest.fn()
const mockDismissTo = jest.fn()

jest.mock('expo-router', () =>
  jest.requireActual('../lib/test-utils').expoRouterMock(() => ({
    push: mockPush,
    dismissTo: mockDismissTo,
  })),
)

jest.mock('../lib/api', () => ({ getMovie: jest.fn() }))
const { getMovie } = jest.requireMock('../lib/api')

jest.mock('../lib/haptics', () => ({ haptic: jest.fn() }))
const mockHaptic = haptic as jest.Mock

const film: Movie = {
  id: mockMovieDetail.id,
  title: mockMovieDetail.title,
  poster_path: mockMovieDetail.poster_path,
  backdrop_path: mockMovieDetail.backdrop_path,
  vote_average: mockMovieDetail.vote_average,
  release_date: mockMovieDetail.release_date,
  overview: mockMovieDetail.overview,
}
const trailer = mockMovieDetail.trailer!
const trailerHref = `/trailer/${trailer.key}?title=${encodeURIComponent(film.title)}`

const os = Platform.OS
const setOS = (OS: typeof Platform.OS) =>
  Object.defineProperty(Platform, 'OS', { value: OS, configurable: true })

beforeEach(() => {
  jest.clearAllMocks()
  setOS('android')
  getMovie.mockResolvedValue(mockMovieDetail)
})

afterEach(() => setOS(os))

type Screen = ReturnType<typeof renderWithProviders>

const longPress = (screen: Screen) => fireEvent(screen.getByText(film.title), 'longPress')

/**
 * Opens the menu, and lets the film request that it sends settle. An answer
 * that lands after the test sets state outside act(), and React warns.
 */
const openMenu = async (screen: Screen) => {
  longPress(screen)
  await act(async () => {
    await getMovie.mock.results.at(-1)?.value.catch(() => {})
  })
}

/** Waits for the exit animation, which also sets state. */
const closed = (screen: Screen) =>
  waitFor(() => expect(screen.queryByTestId('film-menu')).toBeNull())

/** The current list, read the way a screen reads it. */
function Saved({
  onRead,
}: {
  onRead: (movies: ReturnType<typeof useWatchlist>) => void
}) {
  onRead(useWatchlist())
  return null
}

describe('the long press', () => {
  it('opens the menu with the long press haptic', async () => {
    const screen = renderWithProviders(<MovieCard movie={film} />)
    expect(screen.queryByTestId('film-menu')).toBeNull()

    await openMenu(screen)

    expect(mockHaptic).toHaveBeenCalledWith('menu')
    expect(screen.getByTestId('film-menu')).toBeTruthy()
    expect(screen.getByText('Watch trailer')).toBeTruthy()
    expect(screen.getByText('Save to watchlist')).toBeTruthy()
    expect(screen.getByText('Share')).toBeTruthy()
    // Only a saved film has a watched mark.
    expect(screen.queryByText('Mark as watched')).toBeNull()
    // The film is asked for once, and kept for the film page.
    expect(getMovie).toHaveBeenCalledTimes(1)
    expect(readCache(`movie:${film.id}`)?.value).toBe(mockMovieDetail)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('opens the menu from the TalkBack long press action', async () => {
    const screen = renderWithProviders(<MovieCard movie={film} />)
    const card = screen.getByLabelText(/^Dune: Part Two\./)

    expect(card.props.accessibilityActions).toEqual([
      { name: 'longpress', label: 'Show film options' },
    ])
    fireEvent(card, 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } })
    await act(async () => {
      await getMovie.mock.results[0].value
    })

    expect(screen.getByTestId('film-menu')).toBeTruthy()
  })

  it.each(['ios', 'web'] as const)('does nothing on %s', (platform) => {
    setOS(platform)
    const screen = renderWithProviders(<MovieCard movie={film} />)

    longPress(screen)

    expect(screen.queryByTestId('film-menu')).toBeNull()
    expect(mockHaptic).not.toHaveBeenCalled()
    expect(getMovie).not.toHaveBeenCalled()
  })

  it('does nothing in select mode', () => {
    const screen = renderWithProviders(
      <MovieCard movie={film} selection={{ selected: false, onToggle: jest.fn() }} />,
    )

    longPress(screen)

    expect(screen.queryByTestId('film-menu')).toBeNull()
  })

  it('leaves a tap to open the film', () => {
    const screen = renderWithProviders(<MovieCard movie={film} />)

    fireEvent.press(screen.getByText(film.title))

    expect(mockPush).toHaveBeenCalledWith(`/movie/${film.id}`)
    expect(screen.queryByTestId('film-menu')).toBeNull()
  })
})

describe('the trailer', () => {
  it('opens the player, also when pressed before the film arrives', async () => {
    let answer: (detail: typeof mockMovieDetail) => void = () => {}
    getMovie.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const screen = renderWithProviders(<MovieCard movie={film} />)
    longPress(screen)

    fireEvent.press(screen.getByText('Watch trailer'))
    expect(mockPush).not.toHaveBeenCalled()
    await act(async () => answer(mockMovieDetail))

    expect(mockPush).toHaveBeenCalledWith(trailerHref)
    // The press joined the request the menu sent.
    expect(getMovie).toHaveBeenCalledTimes(1)
    await closed(screen)
  })

  it('is grey for a film with no trailer', async () => {
    getMovie.mockResolvedValue({ ...mockMovieDetail, trailer: null })
    const screen = renderWithProviders(<MovieCard movie={film} />)

    await openMenu(screen)

    expect(screen.getByRole('menuitem', { name: 'Watch trailer' })).toBeDisabled()
  })

  it('says so when the film cannot load', async () => {
    getMovie.mockRejectedValue(new Error('Network is down'))
    const screen = renderWithProviders(<MovieCard movie={film} />)
    await openMenu(screen)

    // Not grey: the failure says nothing about the trailer, and the press
    // asks again.
    fireEvent.press(screen.getByText('Watch trailer'))

    expect(await screen.findByText('Could not load the trailer')).toBeTruthy()
    expect(getMovie).toHaveBeenCalledTimes(2)
    expect(mockPush).not.toHaveBeenCalled()
    await closed(screen)
  })

  it('closes the search sheet as the player opens', async () => {
    const screen = renderWithProviders(<MovieCard movie={film} dismissTo />)
    await openMenu(screen)

    fireEvent.press(screen.getByText('Watch trailer'))

    await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith(trailerHref))
    expect(mockPush).not.toHaveBeenCalled()
    await closed(screen)
  })
})

describe('the watchlist', () => {
  const renderWithList = () => {
    const list: { current: ReturnType<typeof useWatchlist> } = {
      current: { movies: [], loaded: false },
    }
    const screen = renderWithProviders(
      <>
        <MovieCard movie={film} />
        <Saved onRead={(read) => (list.current = read)} />
      </>,
    )
    return { screen, list }
  }

  it('saves the film, and the menu then offers to remove it', async () => {
    const { screen, list } = renderWithList()
    await openMenu(screen)

    fireEvent.press(screen.getByText('Save to watchlist'))

    expect(list.current.movies.map((m) => m.id)).toEqual([film.id])
    expect(mockHaptic).toHaveBeenLastCalledWith('save')
    expect(await screen.findByText('Saved to your watchlist')).toBeTruthy()
    await closed(screen)

    longPress(screen)
    expect(screen.getByText('Remove from watchlist')).toBeTruthy()
    expect(screen.getByText('Mark as watched')).toBeTruthy()
  })

  it('removes a saved film, and the undo puts it back', async () => {
    act(() => toggleSaved(film))
    const { screen, list } = renderWithList()
    await openMenu(screen)

    fireEvent.press(screen.getByText('Remove from watchlist'))
    expect(list.current.movies).toEqual([])
    expect(mockHaptic).toHaveBeenLastCalledWith('unsave')

    fireEvent.press(await screen.findByText('Undo'))
    expect(list.current.movies.map((m) => m.id)).toEqual([film.id])
    expect(mockHaptic).toHaveBeenLastCalledWith('save')
    await closed(screen)
  })

  it('marks a saved film watched, and the undo takes the mark off', async () => {
    act(() => toggleSaved(film))
    const { screen, list } = renderWithList()
    await openMenu(screen)

    fireEvent.press(screen.getByText('Mark as watched'))
    expect(isWatched(list.current.movies[0])).toBe(true)
    expect(mockHaptic).toHaveBeenLastCalledWith('save')
    expect(await screen.findByText('Marked as watched')).toBeTruthy()
    await closed(screen)

    fireEvent.press(screen.getByText('Undo'))
    expect(isWatched(list.current.movies[0])).toBe(false)
    expect(mockHaptic).toHaveBeenLastCalledWith('unsave')
  })

  it('offers to take the mark off a watched film', async () => {
    act(() => {
      toggleSaved(film)
      setWatched([film.id], true)
    })
    const { screen } = renderWithList()
    await openMenu(screen)

    fireEvent.press(screen.getByText('Mark as not watched'))

    expect(await screen.findByText('Marked as not watched')).toBeTruthy()
    expect(mockHaptic).toHaveBeenLastCalledWith('unsave')
    await closed(screen)
  })
})

it('shares the film through the system sheet', async () => {
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined })
  const screen = renderWithProviders(<MovieCard movie={film} />)
  await openMenu(screen)

  fireEvent.press(screen.getByText('Share'))

  await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
  // Android reads only `message`, so the link travels in it.
  expect(share.mock.calls[0][0]).toEqual({
    message: `Dune: Part Two (2024)\nhttps://reelist.raajnadar.in/movie/${film.id}`,
  })
  share.mockRestore()
  await closed(screen)
})
