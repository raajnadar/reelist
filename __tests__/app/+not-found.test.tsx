import { fireEvent } from '@testing-library/react-native'
import NotFoundScreen from '../../app/+not-found'
import { renderWithProviders } from '../../lib/test-utils'

// Outside `app/` for the reason movie/[id].test.tsx records: a test file inside
// `app/` becomes an Expo Router route.

const mockDismissTo = jest.fn()

jest.mock('expo-router', () =>
  jest.requireActual('../../lib/test-utils').expoRouterMock(() => ({
    push: jest.fn(),
    dismissTo: mockDismissTo,
  })),
)

// The role reads the root stack, which this render has none of.
// lib/useRootScreenRole.test.tsx checks it in a real router.
jest.mock('../../lib/useRootScreenRole', () => ({ useRootScreenRole: () => 'main' }))

beforeEach(() => {
  jest.clearAllMocks()
})

it('names the page in its heading', () => {
  const screen = renderWithProviders(<NotFoundScreen />)

  expect(screen.getByRole('header', { name: 'Page not found' })).toBeTruthy()
})

// `dismissTo`, not push: the dead link must not stay in the history behind
// home. __tests__/app/(main)/_layout.test.tsx checks the history it leaves.
it('goes home', () => {
  const screen = renderWithProviders(<NotFoundScreen />)

  fireEvent.press(screen.getByText('Go home'))

  expect(mockDismissTo).toHaveBeenCalledWith('/')
})
