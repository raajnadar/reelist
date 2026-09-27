import { fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { renderWithProviders } from '../lib/test-utils'
import type { WatchProviders as Providers } from '../lib/types'
import { WatchProviders } from './WatchProviders'

const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)

beforeEach(() => {
  openURL.mockClear()
})

const providers: Providers = {
  link: 'https://www.themoviedb.org/movie/550/watch?locale=IN',
  stream: [{ id: 8, name: 'Netflix', logo_path: '/8.jpg' }],
  rent: [],
  buy: [
    { id: 2, name: 'Apple TV', logo_path: '/2.jpg' },
    { id: 3, name: 'Google Play', logo_path: null },
  ],
}

it('shows the heading, the groups that have a service, and the credit', () => {
  const screen = renderWithProviders(<WatchProviders providers={providers} />)

  expect(screen.getByText('Where to watch')).toBeTruthy()
  expect(screen.getByText('Stream')).toBeTruthy()
  expect(screen.getByText('Buy')).toBeTruthy()
  expect(screen.queryByText('Rent')).toBeNull()
  expect(screen.getByText('Data from JustWatch')).toBeTruthy()
})

it('draws a logo for each service that has one, and the name for one that does not', () => {
  const screen = renderWithProviders(<WatchProviders providers={providers} />)

  expect(screen.getAllByTestId('provider-logo')).toHaveLength(2)
  expect(screen.getByText('Google Play')).toBeTruthy()
})

// Absent, not empty: a film nobody carries shows no heading above nothing.
it('renders nothing when the film has no providers', () => {
  const screen = renderWithProviders(<WatchProviders providers={null} />)

  expect(screen.queryByText('Where to watch')).toBeNull()
})

// TMDB gives one page for the film and no deep link into each service, so
// every tile opens that page.
it('opens the TMDB watch page for a tapped service', () => {
  const screen = renderWithProviders(<WatchProviders providers={providers} />)

  fireEvent.press(screen.getByLabelText('Netflix. Stream'))

  expect(openURL).toHaveBeenCalledWith(
    'https://www.themoviedb.org/movie/550/watch?locale=IN',
  )
})
