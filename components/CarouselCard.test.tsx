import type { SharedValue } from '@rootnative/inertia'
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '../lib/test-utils'
import type { Movie } from '../lib/types'
import { CarouselCard } from './CarouselCard'

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

const scrollX = { value: 0 } as SharedValue<number>

const renderCard = (onHold = jest.fn()) => {
  const screen = renderWithProviders(
    <CarouselCard
      movie={movie}
      index={0}
      scrollX={scrollX}
      width={240}
      snap={256}
      onHold={onHold}
    />,
  )
  return { screen, card: screen.getByLabelText(/^Fight Club\./) }
}

beforeEach(() => mockPush.mockClear())

// The carousel stops its timer while a finger is on a card, so the reader can
// read the caption. On native no pointer event says a finger is down, so this
// report is the only signal the timer gets.
it('reports the hold when a finger goes down and comes up', () => {
  const onHold = jest.fn()
  const { card } = renderCard(onHold)

  fireEvent(card, 'pressIn')
  expect(onHold).toHaveBeenLastCalledWith(true)

  fireEvent(card, 'pressOut')
  expect(onHold).toHaveBeenLastCalledWith(false)
})

// The long-press handler that keeps a reader on the home screen after a hold
// must not take the tap with it.
it('opens the film on a tap', () => {
  const { card } = renderCard()

  fireEvent.press(card)

  expect(mockPush).toHaveBeenCalledWith('/movie/550')
})
