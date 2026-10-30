import { fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { renderWithProviders } from '../lib/test-utils'
import type { Movie } from '../lib/types'
import { MovieCard } from './MovieCard'

const mockPush = jest.fn()

jest.mock('expo-router', () =>
  jest.requireActual('../lib/test-utils').expoRouterMock(() => ({ push: mockPush })),
)

const movie: Movie = {
  id: 550,
  title: 'Fight Club',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  vote_average: 8.4,
  release_date: '1999-10-15',
  overview: 'A ticking-time-bomb insomniac.',
}

describe('the poster', () => {
  it('builds the TMDB url from the path fragment', () => {
    const screen = renderWithProviders(<MovieCard movie={movie} />)

    // `source` arrives as an array: expo-image normalises a single source
    // into the list it selects from at render.
    expect(screen.getByTestId('movie-poster').props.source).toEqual([
      { uri: 'https://image.tmdb.org/t/p/w342/poster.jpg' },
    ])
  })

  /**
   * The regression this file exists for. A remote picture has no measurable size
   * until it loads, so an image with no width and height lays out at zero
   * and the poster never appears — which is what happened to the Popular
   * and Top rated rows while the carousel looked fine.
   *
   * The assertion is on the resolved style, so it fails whether the size is
   * removed or set to zero.
   */
  it('gives the image a real size, not a zero-height box', () => {
    const screen = renderWithProviders(<MovieCard movie={movie} />)

    const style = StyleSheet.flatten(screen.getByTestId('movie-poster').props.style)

    expect(style.width).toBe('100%')
    expect(style.aspectRatio).toBe(2 / 3)
  })

  /**
   * The row is a FlatList, which hands one host view to a different film as it
   * scrolls. Without the key the recycled view keeps the previous poster until
   * the new one downloads, so a fast scroll shows the wrong film under the
   * right title.
   */
  it('keys the poster to the film, so a recycled row cannot show the last one', () => {
    const screen = renderWithProviders(<MovieCard movie={movie} />)

    expect(screen.getByTestId('movie-poster').props.recyclingKey).toBe(String(movie.id))
  })

  // A film with no artwork must show the label instead of an empty slot.
  it('shows the fallback when the film has no poster', () => {
    const screen = renderWithProviders(
      <MovieCard movie={{ ...movie, poster_path: null }} />,
    )

    expect(screen.getByText('No poster')).toBeTruthy()
    expect(screen.queryByTestId('movie-poster')).toBeNull()
  })
})

describe('the text', () => {
  it('shows the title and the meta line', () => {
    const screen = renderWithProviders(<MovieCard movie={movie} />)

    expect(screen.getByText('Fight Club')).toBeTruthy()
    expect(screen.getByText('★ 8.4 · 1999')).toBeTruthy()
  })

  it('caps the title at two lines', () => {
    const screen = renderWithProviders(<MovieCard movie={movie} />)

    expect(screen.getByText('Fight Club').props.numberOfLines).toBe(2)
  })

  /**
   * The second regression this file exists for. `numberOfLines` caps the text
   * but reserves no space, so a one-line title used to make a shorter card than
   * a two-line one, and a horizontal row was ragged along the bottom.
   *
   * The check compares a short title against a long one instead of asserting a
   * number, so it holds when the type scale changes and fails if either title
   * stops reserving the same height.
   */
  it('reserves the same title height for a short and a long title', () => {
    const short = renderWithProviders(<MovieCard movie={movie} />)
    const shortHeight = StyleSheet.flatten(
      short.getByText('Fight Club').props.style,
    ).height

    short.unmount()

    const longTitle = 'The Lord of the Rings: The Fellowship of the Ring Extended Edition'
    const long = renderWithProviders(<MovieCard movie={{ ...movie, title: longTitle }} />)
    const longHeight = StyleSheet.flatten(long.getByText(longTitle).props.style).height

    expect(shortHeight).toBe(longHeight)
    // A reserved box, not a collapsed one.
    expect(shortHeight).toBeGreaterThan(0)
  })
})

describe('select mode', () => {
  it('is one checkbox that picks the film and does not open it', () => {
    const onToggle = jest.fn()
    const screen = renderWithProviders(
      <MovieCard movie={movie} selection={{ selected: true, onToggle }} />,
    )

    // One control: the drawn checkbox shows the state and is hidden from a
    // screen reader, so the card alone reads as the checkbox.
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(1)
    expect(checkboxes[0]).toBeChecked()

    fireEvent.press(checkboxes[0])

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('picks the film on Space, the key of a checkbox on the web', () => {
    const onToggle = jest.fn()
    const preventDefault = jest.fn()
    const screen = renderWithProviders(
      <MovieCard movie={movie} selection={{ selected: false, onToggle }} />,
    )
    const card = screen.getByRole('checkbox')

    fireEvent(card, 'keyDown', { nativeEvent: { key: ' ' }, preventDefault })
    expect(onToggle).toHaveBeenCalledTimes(1)
    // The page must not scroll.
    expect(preventDefault).toHaveBeenCalled()

    // A held key repeats, and the repeats do not pick and drop the film.
    fireEvent(card, 'keyDown', {
      nativeEvent: { key: ' ', repeat: true },
      preventDefault,
    })
    // react-native-web presses on Enter itself, so the handler leaves it.
    fireEvent(card, 'keyDown', { nativeEvent: { key: 'Enter' }, preventDefault })
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('opens the film outside select mode', () => {
    const screen = renderWithProviders(<MovieCard movie={movie} />)

    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.press(screen.getByText('Fight Club'))

    expect(mockPush).toHaveBeenCalledWith('/movie/550')
  })
})
