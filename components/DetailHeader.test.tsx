import { fireEvent } from '@testing-library/react-native'
import { useMotionValue } from '@rootnative/inertia'
import { renderWithProviders } from '../lib/test-utils'
import { DetailHeader } from './DetailHeader'

/**
 * The floating bar over the detail masthead.
 *
 * Everything it animates — the background, the title, the disc behind the back
 * arrow — runs on the UI thread against a shared value, so a test cannot read
 * the opacity at a given scroll position. What it can hold is the contract the
 * screen depends on: the back button answers a tap at every scroll position,
 * and the title is present for the reveal rather than mounted on the way.
 */

// `scrollY` is a shared value in the app. A hook cannot be called outside a
// component, so this host stands in for the screen.
function Host({ title = 'Dune: Part Two' }: { title?: string } = {}) {
  const scrollY = useMotionValue(0)

  return <DetailHeader title={title} scrollY={scrollY} revealAt={240} onBack={onBack} />
}

const onBack = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
})

it('calls back when the arrow is pressed', () => {
  const screen = renderWithProviders(<Host />)

  fireEvent.press(screen.getByLabelText('Go back'))

  expect(onBack).toHaveBeenCalledTimes(1)
})

// The title is mounted from the start and revealed by opacity. Mounting it at
// the threshold instead would need a JS round trip per frame, which is the
// thing the shared value exists to avoid.
it('mounts the title before the reveal', () => {
  const screen = renderWithProviders(<Host />)

  expect(screen.getByText('Dune: Part Two')).toBeTruthy()
})

// The screen passes an empty title while the film is still loading and while an
// error is on screen. The bar has to render its back button either way.
it('renders the back button with no title', () => {
  const screen = renderWithProviders(<Host title="" />)

  expect(screen.getByLabelText('Go back')).toBeTruthy()
})

/**
 * `revealAt` is the masthead height, and a zero-width interpolation range has
 * no answer to give. The component widens the range itself, so a screen with no
 * masthead — the error state — still renders rather than throwing on NaN.
 */
it('renders with a reveal point of zero', () => {
  function ZeroHost() {
    const scrollY = useMotionValue(0)

    return <DetailHeader title="Dune" scrollY={scrollY} revealAt={0} onBack={onBack} />
  }

  const screen = renderWithProviders(<ZeroHost />)

  expect(screen.getByLabelText('Go back')).toBeTruthy()
})
