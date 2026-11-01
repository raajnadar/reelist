import { BlurTargetView, BlurView } from 'expo-blur'
import { Platform, Text } from 'react-native'
import { renderWithProviders } from '../lib/test-utils'
import { GlassLayer, GlassTarget } from './GlassLayer'

/**
 * expo-blur on Android blurs only the `BlurTargetView` that the `BlurView`
 * names. A missing target fails no type check and throws nothing: the sheet
 * draws the tint alone, and the screen below shows sharp through it.
 */
const glass = () =>
  renderWithProviders(
    <>
      <GlassTarget>
        <Text>Page</Text>
      </GlassTarget>
      <GlassLayer onPress={() => {}} />
    </>,
  )

afterEach(() => {
  jest.restoreAllMocks()
})

it('blurs the screens in the target on Android', () => {
  jest.replaceProperty(Platform, 'OS', 'android')
  const screen = glass()

  const target = screen.UNSAFE_getByType(BlurTargetView)
  expect(target.findByType(Text).props.children).toBe('Page')
  expect(screen.UNSAFE_getByType(BlurView).props.blurTarget.current).not.toBeNull()
})

// iOS and the web blur what is behind the view. The wrapper would only add an
// element to every page of the web export.
it.each(['ios', 'web'] as const)('adds no wrapper on %s', (os) => {
  jest.replaceProperty(Platform, 'OS', os)
  const screen = glass()

  expect(screen.UNSAFE_queryByType(BlurTargetView)).toBeNull()
  expect(screen.getByText('Page')).toBeTruthy()
})
