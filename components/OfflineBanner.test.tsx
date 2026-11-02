import { renderWithProviders } from '../lib/test-utils'
import { OfflineBanner } from './OfflineBanner'

// When the notice shows, and where, is AppNavigation's choice. Its test
// covers that.
it('tells the reader they are offline, as a status landmark', () => {
  const screen = renderWithProviders(<OfflineBanner />)

  const banner = screen.getByTestId('offline-banner')
  expect(banner.props.role).toBe('status')
  expect(screen.getByText(/You are offline/)).toBeTruthy()
})
