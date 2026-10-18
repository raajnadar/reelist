import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '../lib/test-utils'
import { UpdateSnackbar } from './UpdateSnackbar'

const mockReload = jest.fn((_options: unknown) => Promise.resolve())
let mockUpdatePending = false

jest.mock('expo-updates', () => ({
  useUpdates: () => ({ isUpdatePending: mockUpdatePending }),
  reloadAsync: (options: unknown) => mockReload(options),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockUpdatePending = false
})

it('shows nothing while no update is downloaded', () => {
  const screen = renderWithProviders(<UpdateSnackbar />)

  expect(screen.queryByText('A new version is ready')).toBeNull()
})

it('restarts into the downloaded update when the reader asks', () => {
  mockUpdatePending = true

  const screen = renderWithProviders(<UpdateSnackbar />)
  expect(screen.getByText('A new version is ready')).toBeTruthy()

  fireEvent.press(screen.getByText('Restart'))

  expect(mockReload).toHaveBeenCalledWith({
    reloadScreenOptions: expect.objectContaining({ backgroundColor: '#4C0519' }),
  })
})

it('does not restart when the reader closes the snackbar', () => {
  mockUpdatePending = true

  const screen = renderWithProviders(<UpdateSnackbar />)
  fireEvent.press(screen.getByLabelText('Dismiss'))

  expect(mockReload).not.toHaveBeenCalled()
})
