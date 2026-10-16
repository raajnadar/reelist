import { fireEvent } from '@testing-library/react-native'
import NotFoundScreen from '../../app/+not-found'
import { renderWithProviders } from '../../lib/test-utils'

// Outside `app/` for the reason movie/[id].test.tsx records: a test file inside
// `app/` becomes an Expo Router route.

const mockReplace = jest.fn()

jest.mock('expo-router', () =>
  jest.requireActual('../../lib/test-utils').expoRouterMock(() => ({
    push: jest.fn(),
    replace: mockReplace,
  })),
)

beforeEach(() => {
  jest.clearAllMocks()
})

it('names the page in its heading', () => {
  const screen = renderWithProviders(<NotFoundScreen />)

  expect(screen.getByRole('header', { name: 'Page not found' })).toBeTruthy()
})

// Replace, not push: the dead link must not stay in the history behind home.
it('goes home', () => {
  const screen = renderWithProviders(<NotFoundScreen />)

  fireEvent.press(screen.getByText('Go home'))

  expect(mockReplace).toHaveBeenCalledWith('/')
})
