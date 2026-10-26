import { renderWithProviders } from '../lib/test-utils'
import { OfflineBanner } from './OfflineBanner'

let mockOnline = true
let mockPathname = '/'

jest.mock('../lib/network', () => ({
  useOnline: () => mockOnline,
}))

jest.mock('expo-router', () => ({
  ...jest.requireActual('../lib/test-utils').expoRouterMock(),
  usePathname: () => mockPathname,
}))

beforeEach(() => {
  mockOnline = true
  mockPathname = '/'
})

it('draws nothing while the device is online', () => {
  const screen = renderWithProviders(<OfflineBanner />)

  expect(screen.queryByTestId('offline-banner')).toBeNull()
})

it('tells the reader they are offline, as a status landmark', () => {
  mockOnline = false
  const screen = renderWithProviders(<OfflineBanner />)

  const banner = screen.getByTestId('offline-banner')
  expect(banner.props.role).toBe('status')
  expect(screen.getByText(/You are offline/)).toBeTruthy()
})

it('steps aside with the navigation on the trailer and the gallery', () => {
  mockOnline = false
  mockPathname = '/trailer/abc'
  const screen = renderWithProviders(<OfflineBanner />)

  expect(screen.queryByTestId('offline-banner')).toBeNull()
})
