import { fireEvent } from '@testing-library/react-native'
import { Dimensions, StyleSheet } from 'react-native'
import { renderWithProviders } from '../../../lib/test-utils'
import TrailerScreen from '../../../app/trailer/[key]'
import { PLAYER_ORIGIN } from '../../../lib/youtube'

// Like the other screen tests, this one stays outside `app/`. A test file in
// that folder becomes a route: Expo Router builds its table with
// `require.context('./app')`, and Metro would then bundle the testing library
// into the app.

const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockCanGoBack = jest.fn()
const mockUseLocalSearchParams = jest.fn()

// `Stack.Screen` carries the presentation options. It renders nothing, and the
// real one needs a navigator above it that no test mounts.
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    push: jest.fn(),
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}))

// The web view is a native module with no JavaScript implementation in Jest.
// The mock keeps the props, because the URL it is given is what the test
// checks: the screen passes the key through and builds nothing itself.
jest.mock('react-native-webview', () => ({
  // A factory cannot close over a value from the file, so the real module is
  // reached from inside it. `jest.requireActual` rather than `require`, which
  // the repository lints against outside a Node file.
  WebView: jest.requireActual('react-native').View,
}))

// The one call this screen makes outside itself, for the YouTube button.
jest.mock('expo-linking', () => ({ openURL: jest.fn() }))

const { openURL } = jest.requireMock('expo-linking')

const KEY = 'Way9Dexny3w'

// Renders the screen and hands back the props of the video surface.
const playerProps = () =>
  renderWithProviders(<TrailerScreen />).getByTestId('trailer-player').props

beforeEach(() => {
  jest.clearAllMocks()
  mockCanGoBack.mockReturnValue(true)
  // The handler calls `.catch` on the result, so the mock has to answer with a
  // promise rather than undefined.
  openURL.mockResolvedValue(true)
})

describe('a link that names a video', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ key: KEY, title: 'Dune' })
  })

  // The web view takes a page holding the embed, not the embed URL. A web view
  // sent straight to the embed is a top-level document with no referrer, and
  // YouTube answers that with error 153. See lib/youtube.ts.
  it('loads a page holding the embed for the key', () => {
    const { source } = playerProps()

    expect(source.html).toContain(`/embed/${KEY}`)
    expect(source.uri).toBeUndefined()
  })

  // The referrer the embed request carries comes from this. It has to be a real
  // third-party site: YouTube answers a missing referrer with error 153 and its
  // own origin with error 152.
  it('serves that page from the site the app is published at', () => {
    expect(playerProps().source.baseUrl).toBe(PLAYER_ORIGIN)
    expect(playerProps().source.baseUrl).not.toContain('youtube.com')
  })

  it('names the film in the bar', () => {
    const screen = renderWithProviders(<TrailerScreen />)

    expect(screen.getByText('Dune')).toBeTruthy()
  })

  /**
   * The title sits on the centreline of the close button beside it.
   *
   * `titleMedium` carries 24 points of line height against a 16 point font,
   * which is leading for a paragraph. iOS puts all of it above the glyphs, so
   * the text draws low inside a box that the row has centred correctly — the
   * two then read as misaligned. The screen drops the line height for this one
   * line, and this holds it dropped.
   */
  it('gives the title no paragraph line height', () => {
    const screen = renderWithProviders(<TrailerScreen />)

    const { lineHeight } = StyleSheet.flatten(screen.getByText('Dune').props.style)

    expect(lineHeight).toBeUndefined()
  })

  /**
   * The frame keeps 16:9 and fits inside the window.
   *
   * The test metrics are a 390 x 844 phone with a 47 top inset and a 34 bottom
   * one, so the width is the limit and the height follows from it. A frame that
   * ignored the ratio would stretch the video.
   */
  /**
   * The frame, in the two windows that limit it differently.
   *
   * `Dimensions.get` is what `useWindowDimensions` reads, and it is the seam
   * the other screen tests pin their window with. The insets come from the
   * provider in lib/test-utils: 47 at the top and 34 at the bottom.
   *
   * The native surface takes its size in the style, where the web one takes it
   * in props. The screen computes the same two numbers for both.
   */
  const frameOf = (screen: ReturnType<typeof renderWithProviders>) =>
    StyleSheet.flatten(screen.getByTestId('trailer-player').props.style)

  const pinWindow = (width: number, height: number) => {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width, height, scale: 2, fontScale: 1 } as never)
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // A phone held upright. The width runs out first, and the height follows
  // from the ratio.
  it('fills the width of a tall window', () => {
    pinWindow(390, 844)

    const { width, height } = frameOf(renderWithProviders(<TrailerScreen />))

    expect(width).toBe(390)
    expect(height).toBeCloseTo(390 * (9 / 16))
  })

  // A desktop window. The height runs out first, so a frame sized from the
  // width alone would run past the bottom of the screen.
  it('fits the height of a wide window', () => {
    pinWindow(1440, 900)

    const { width, height } = frameOf(renderWithProviders(<TrailerScreen />))

    // 900 less the two insets and the bar above the video.
    const stage = 900 - 47 - 34 - 56

    expect(height).toBeCloseTo(stage)
    expect(width).toBeCloseTo(stage * (16 / 9))
    expect(width).toBeLessThan(1440)
  })

  // A studio can block a video from embedding, and the app cannot detect that.
  // The way out has to be there before it is needed. See lib/youtube.ts.
  it('offers the YouTube page as well', () => {
    const screen = renderWithProviders(<TrailerScreen />)

    fireEvent.press(screen.getByLabelText('Open in YouTube'))

    expect(openURL).toHaveBeenCalledWith(`https://www.youtube.com/watch?v=${KEY}`)
  })

  it('closes back to the screen underneath', () => {
    const screen = renderWithProviders(<TrailerScreen />)

    fireEvent.press(screen.getByLabelText('Close the trailer'))

    expect(mockBack).toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  // A deep link opens the player as the first screen in the history, where
  // there is nothing to go back to. `router.back` alone would dead-end there.
  it('closes to the home screen when there is no history', () => {
    mockCanGoBack.mockReturnValue(false)

    const screen = renderWithProviders(<TrailerScreen />)

    fireEvent.press(screen.getByLabelText('Close the trailer'))

    expect(mockReplace).toHaveBeenCalledWith('/')
    expect(mockBack).not.toHaveBeenCalled()
  })
})

/**
 * A link with no key in it. There is no request to retry and no video to name,
 * so the screen reports it and offers only the way out.
 */
describe('a link that names no video', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({})
  })

  it('reports the link instead of loading a player', () => {
    const screen = renderWithProviders(<TrailerScreen />)

    expect(screen.getByTestId('trailer-error')).toBeTruthy()
    expect(screen.queryByTestId('trailer-player')).toBeNull()
  })

  // The YouTube button has no key to open, so it is absent rather than dead.
  it('offers no YouTube button', () => {
    const screen = renderWithProviders(<TrailerScreen />)

    expect(screen.queryByLabelText('Open in YouTube')).toBeNull()
  })

  it('goes back from the report', () => {
    const screen = renderWithProviders(<TrailerScreen />)

    fireEvent.press(screen.getByText('Go back'))

    expect(mockBack).toHaveBeenCalled()
  })
})

// The title is a convenience from the screen that pushed this one, not a
// requirement. A deep link carries a key and no title.
it('falls back to a plain heading with no title parameter', () => {
  mockUseLocalSearchParams.mockReturnValue({ key: KEY })

  const screen = renderWithProviders(<TrailerScreen />)

  expect(screen.getByText('Trailer')).toBeTruthy()
})
