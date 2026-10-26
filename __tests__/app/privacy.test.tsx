import { fireEvent, waitFor } from '@testing-library/react-native'
import { Linking } from 'react-native'
import PrivacyScreen from '../../app/(main)/privacy'
import { renderWithProviders } from '../../lib/test-utils'

// Outside `app/` for the reason movie/[id].test.tsx records: a test file inside
// `app/` becomes an Expo Router route.

const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn(() => true)

jest.mock('expo-router', () =>
  jest.requireActual('../../lib/test-utils').expoRouterMock(() => ({
    push: jest.fn(),
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  })),
)

// Spied for the reason about.test.tsx gives.
const openURL = jest
  .spyOn(Linking, 'openURL')
  .mockImplementation(() => Promise.resolve(true))

beforeEach(() => {
  jest.clearAllMocks()
  mockCanGoBack.mockReturnValue(true)
})

it('names each service that receives a request', () => {
  const screen = renderWithProviders(<PrivacyScreen />)

  for (const title of [
    'The Reelist server',
    'TMDB',
    'YouTube',
    'App updates',
    'The web version',
  ]) {
    expect(screen.getByText(title)).toBeTruthy()
  }
  expect(screen.getByText(/^Updated /)).toBeTruthy()
})

it('opens the policy of a service', async () => {
  const screen = renderWithProviders(<PrivacyScreen />)

  fireEvent.press(screen.getByText('TMDB privacy policy'))

  await waitFor(() =>
    expect(openURL).toHaveBeenCalledWith('https://www.themoviedb.org/privacy-policy'),
  )
})

it('goes back', () => {
  const screen = renderWithProviders(<PrivacyScreen />)

  fireEvent.press(screen.getByLabelText('Go back'))
  expect(mockBack).toHaveBeenCalled()
})

it('returns to the home screen when there is nowhere to go back to', () => {
  // The Play listing links straight to this page, so on the web it is often
  // the first entry in the history.
  mockCanGoBack.mockReturnValue(false)

  const screen = renderWithProviders(<PrivacyScreen />)

  fireEvent.press(screen.getByLabelText('Go back'))
  expect(mockBack).not.toHaveBeenCalled()
  expect(mockReplace).toHaveBeenCalledWith('/')
})
