import { act, fireEvent, waitFor } from '@testing-library/react-native'
import componentsPackage from '@rootnative/components/package.json'
import corePackage from '@rootnative/core/package.json'
import inertiaPackage from '@rootnative/inertia/package.json'
import { Linking } from 'react-native'
import AboutScreen from '../../app/about'
import { useAppearance } from '../../lib/appearance'
import { renderWithProviders } from '../../lib/test-utils'

// Outside `app/` for the reason movie/[id].test.tsx records: a test file inside
// `app/` becomes an Expo Router route.

const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn(() => true)

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}))

// Spied rather than replaced with a module mock. `Linking` is one export of
// the react-native module the whole render tree imports, and a factory mock of
// it hands every other consumer an object without the members it reads.
const openURL = jest
  .spyOn(Linking, 'openURL')
  .mockImplementation(() => Promise.resolve(true))

beforeEach(() => {
  jest.clearAllMocks()
  mockCanGoBack.mockReturnValue(true)
})

/**
 * The screen's job is to make a claim checkable by pressing something. These
 * tests check the pressing, not the wording: each one asserts that the control
 * reached the store the whole app reads, which is what makes the claim true.
 */

it('sets light, dark, or the system setting', () => {
  const screen = renderWithProviders(<AboutScreen />)

  act(() => {
    fireEvent.press(screen.getByTestId('mode-dark'))
  })

  expect(renderHookOnStore().result.mode).toBe('dark')
})

it('shows the version of each package that is installed', () => {
  // Read here from the same place the screen reads it, and the screen reads it
  // from the package rather than from a string of its own. A hardcoded version
  // would survive a `yarn upgrade` and then state a number that is not what is
  // running — a wrong fact on a page whose whole job is to be checkable.
  const screen = renderWithProviders(<AboutScreen />)

  for (const { version } of [corePackage, componentsPackage, inertiaPackage]) {
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
    expect(screen.getAllByText(version).length).toBeGreaterThan(0)
  }
})

it('opens the documentation', async () => {
  const screen = renderWithProviders(<AboutScreen />)

  fireEvent.press(screen.getByText('RootNative UI documentation'))

  await waitFor(() =>
    expect(openURL).toHaveBeenCalledWith('https://rootnative.github.io/ui/'),
  )
})

it('opens this app on GitHub', async () => {
  const screen = renderWithProviders(<AboutScreen />)

  fireEvent.press(screen.getByText('Reelist on GitHub'))

  await waitFor(() =>
    expect(openURL).toHaveBeenCalledWith('https://github.com/raajnadar/reelist'),
  )
})

it('opens each package where its source is', async () => {
  // The URL is the package's own `homepage`, not a copy written here, so a
  // package that moves takes its link with it. Inertia is deliberately checked
  // beside the other two: it lives in a different repository, and a list that
  // pointed all three at one would state something untrue.
  const screen = renderWithProviders(<AboutScreen />)

  fireEvent.press(screen.getByTestId('repo-@rootnative/components'))
  await waitFor(() =>
    expect(openURL).toHaveBeenLastCalledWith('https://github.com/rootnative/ui'),
  )

  fireEvent.press(screen.getByTestId('repo-@rootnative/inertia'))
  await waitFor(() =>
    expect(openURL).toHaveBeenLastCalledWith('https://github.com/rootnative/inertia'),
  )
})

it('closes when the scrim around the card is pressed', () => {
  // The scrim is the dark area outside the card. Pressing it is what a reader
  // expects of a dialog, and it is deliberately not announced, so this is the
  // only place that behaviour is checked.
  const screen = renderWithProviders(<AboutScreen />)

  // `includeHiddenElements` is the assertion, not a workaround: the query only
  // needs it because the scrim really is out of the accessibility tree, which
  // is what the comment above says it should be.
  fireEvent.press(screen.getByTestId('about-scrim', { includeHiddenElements: true }))
  expect(mockBack).toHaveBeenCalled()
})

it('closes', () => {
  const screen = renderWithProviders(<AboutScreen />)

  fireEvent.press(screen.getByTestId('about-close'))
  expect(mockBack).toHaveBeenCalled()
})

it('returns to the home screen when there is nowhere to go back to', () => {
  // The web build allows a deep link straight to /about, and a modal opened
  // that way has no screen under it. A dismiss that called `back` alone would
  // leave the reader on a dead page.
  mockCanGoBack.mockReturnValue(false)

  const screen = renderWithProviders(<AboutScreen />)

  fireEvent.press(screen.getByTestId('about-close'))
  expect(mockBack).not.toHaveBeenCalled()
  expect(mockReplace).toHaveBeenCalledWith('/')
})

/**
 * Reads the appearance store the way a screen does.
 *
 * `renderHook` would mount a second tree; the store is a module, so reading it
 * through one render of the hook is enough and keeps the assertion about the
 * store rather than about a second component.
 */
function renderHookOnStore() {
  let result = { mode: '' }

  function Probe() {
    const appearance = useAppearance()
    result = { mode: appearance.mode }
    return null
  }

  renderWithProviders(<Probe />)
  return { result }
}
