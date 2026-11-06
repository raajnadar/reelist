import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, waitFor } from '@testing-library/react-native'
import TipsScreen from '../../app/(main)/tips'
import { renderWithProviders } from '../../lib/test-utils'
import { STORAGE_KEY, TIPS } from '../../lib/tips'

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

beforeEach(() => {
  jest.clearAllMocks()
  mockCanGoBack.mockReturnValue(true)
})

it('lists every tip of the platform', () => {
  const screen = renderWithProviders(<TipsScreen />)

  for (const tip of TIPS) {
    expect(screen.getByText(tip.title)).toBeTruthy()
    expect(screen.getByText(tip.body)).toBeTruthy()
  }
})

it('marks the tips as seen, so the home card and the badge go', async () => {
  renderWithProviders(<TipsScreen />)

  await waitFor(async () =>
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? 'null')).toEqual({
      seen: true,
    }),
  )
})

it('goes back, or home when the page is the first in the history', () => {
  const screen = renderWithProviders(<TipsScreen />)

  fireEvent.press(screen.getByLabelText('Go back'))
  expect(mockBack).toHaveBeenCalled()

  mockCanGoBack.mockReturnValue(false)
  fireEvent.press(screen.getByLabelText('Go back'))
  expect(mockReplace).toHaveBeenCalledWith('/')
})
