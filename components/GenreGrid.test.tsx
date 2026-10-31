import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '../lib/test-utils'
import type { Genre } from '../lib/types'
import { GenreGrid } from './GenreGrid'

const mockPush = jest.fn()

jest.mock('expo-router', () =>
  jest.requireActual('../lib/test-utils').expoRouterMock(() => ({ push: mockPush })),
)

beforeEach(() => {
  mockPush.mockClear()
})

const genres: Genre[] = [
  { id: 28, name: 'Action' },
  { id: 878, name: 'Science Fiction' },
]

describe('GenreGrid', () => {
  it('shows every genre', () => {
    const screen = renderWithProviders(<GenreGrid genres={genres} />)

    expect(screen.getByText('Browse by genre')).toBeTruthy()
    expect(screen.getByText('Action')).toBeTruthy()
    expect(screen.getByText('Science Fiction')).toBeTruthy()
  })

  // The genre page reads the name from the address, so it can title itself
  // before the genre list answers.
  it('opens the genre page with the name in the address', () => {
    const screen = renderWithProviders(<GenreGrid genres={genres} />)

    fireEvent.press(screen.getByText('Science Fiction'))

    expect(mockPush).toHaveBeenCalledWith('/genre/878?name=Science%20Fiction')
  })

  // A failed genre request must leave no heading over an empty space.
  it('renders nothing for an empty list', () => {
    const screen = renderWithProviders(<GenreGrid genres={[]} />)

    expect(screen.queryByTestId('genre-grid')).toBeNull()
    expect(screen.queryByText('Browse by genre')).toBeNull()
  })
})
