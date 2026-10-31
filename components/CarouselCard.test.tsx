import type { SharedValue } from '@rootnative/inertia'
import { fireEvent } from '@testing-library/react-native'
import type { ComponentProps } from 'react'
import { Platform } from 'react-native'
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

const renderCard = (props: Partial<ComponentProps<typeof CarouselCard>> = {}) => {
  const screen = renderWithProviders(
    <CarouselCard
      movie={movie}
      index={0}
      scrollX={scrollX}
      width={240}
      snap={256}
      {...props}
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
  const { card } = renderCard({ onHold })

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

// The loop holds thousands of slots, and each card is a link. A Tab walk
// through them never reached the controls or the rows below.
describe('on the web', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('keeps only the centred card in the tab order', () => {
    expect(renderCard({ current: true }).card.props.tabIndex).toBe(0)
    expect(renderCard({ current: false }).card.props.tabIndex).toBe(-1)
  })

  it('moves the list with the left and right arrow keys', () => {
    const onArrowKey = jest.fn()
    const preventDefault = jest.fn()
    const { card } = renderCard({ current: true, onArrowKey })
    const press = (key: string, more = {}) =>
      fireEvent(card, 'keyDown', { nativeEvent: { key, ...more }, preventDefault })

    press('ArrowRight')
    press('ArrowLeft')
    expect(onArrowKey.mock.calls).toEqual([[1], [-1]])
    expect(preventDefault).toHaveBeenCalledTimes(2)

    // A held key, a browser shortcut such as Alt and the left arrow for back,
    // and any other key do nothing.
    press('ArrowRight', { repeat: true })
    press('ArrowLeft', { altKey: true })
    press('Enter')
    expect(onArrowKey).toHaveBeenCalledTimes(2)
    expect(preventDefault).toHaveBeenCalledTimes(2)
  })
})

it('leaves the keyboard focus alone on native', () => {
  expect(renderCard({ current: false }).card.props.tabIndex).toBeUndefined()
})
