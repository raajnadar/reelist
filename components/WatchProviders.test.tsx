import { act, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { setRegion } from '../lib/region'
import { renderWithProviders } from '../lib/test-utils'
import type { WatchProviders as Providers } from '../lib/types'
import { WatchProviders } from './WatchProviders'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)

beforeEach(() => {
  openURL.mockClear()
  mockPush.mockClear()
})

// The mocked device is in the United States. India is the other country.
const providers: Record<string, Providers> = {
  US: {
    link: 'https://www.themoviedb.org/movie/550/watch?locale=US',
    stream: [{ id: 8, name: 'Netflix', logo_path: '/8.jpg' }],
    rent: [],
    buy: [
      { id: 2, name: 'Apple TV', logo_path: '/2.jpg' },
      { id: 3, name: 'Google Play', logo_path: null },
    ],
  },
  IN: {
    link: 'https://www.themoviedb.org/movie/550/watch?locale=IN',
    stream: [{ id: 122, name: 'Hotstar', logo_path: '/122.jpg' }],
    rent: [],
    buy: [],
  },
}

it('shows the heading, the country, the groups that have a service, and the credit', () => {
  const screen = renderWithProviders(<WatchProviders providers={providers} />)

  expect(screen.getByText('Where to watch')).toBeTruthy()
  expect(screen.getByText('United States')).toBeTruthy()
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

it('follows the country the reader chose', () => {
  const screen = renderWithProviders(<WatchProviders providers={providers} />)

  act(() => setRegion('IN'))

  expect(screen.getByText('India')).toBeTruthy()
  expect(screen.getByLabelText('Hotstar. Stream')).toBeTruthy()
  expect(screen.queryByText('Netflix')).toBeNull()
})

// A film carried elsewhere but not here. The reader learns that, and sees the
// country they can change, rather than a section that is silently absent.
it('says so when no service carries the film in the chosen country', () => {
  const screen = renderWithProviders(<WatchProviders providers={providers} />)

  act(() => setRegion('DE'))

  expect(
    screen.getByText('No streaming service carries this film in Germany yet.'),
  ).toBeTruthy()
  expect(screen.queryByTestId('provider-logo')).toBeNull()
})

// Absent, not empty: a film nobody carries anywhere shows no heading above
// nothing.
it('renders nothing when the film has no providers anywhere', () => {
  const screen = renderWithProviders(<WatchProviders providers={{}} />)

  expect(screen.queryByText('Where to watch')).toBeNull()
})

it('opens the settings from the country name', () => {
  const screen = renderWithProviders(<WatchProviders providers={providers} />)

  fireEvent.press(screen.getByLabelText('Region: United States. Change'))

  expect(mockPush).toHaveBeenCalledWith('/about')
})

// TMDB gives one page per country for the film and no deep link into each
// service, so every tile opens that page.
it('opens the TMDB watch page for a tapped service', () => {
  const screen = renderWithProviders(<WatchProviders providers={providers} />)

  fireEvent.press(screen.getByLabelText('Netflix. Stream'))

  expect(openURL).toHaveBeenCalledWith(
    'https://www.themoviedb.org/movie/550/watch?locale=US',
  )
})
