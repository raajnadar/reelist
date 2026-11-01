import { fireEvent, render } from '@testing-library/react-native'
import { Platform, View } from 'react-native'
import Svg, { Rect, Stop } from 'react-native-svg'
import { Scrim } from './Scrim'

/**
 * The gradient that dissolves the detail masthead into the page.
 *
 * The one thing here that can break silently is the gradient id. On web each
 * Scrim becomes a real `<svg>` in one document, so a fixed id would make the
 * last definition win for every instance — the top wash and the bottom fade
 * would both paint the same sweep. The detail screen renders two.
 */

const stops = [
  [0, 0],
  [1, 1],
] as const

// `useId` is per-instance, so two scrims in one tree must not agree.
it('gives each instance its own gradient id', () => {
  const tree = render(
    <View>
      <Scrim color="#000000" stops={stops} />
      <Scrim color="#FFFFFF" stops={stops} />
    </View>,
  )

  // The Rect's fill carries the reference, which is what a collision breaks.
  const ids = tree.UNSAFE_getAllByType(Rect).map((node) => node.props.fill)

  expect(ids).toHaveLength(2)
  expect(ids[0]).not.toEqual(ids[1])
})

// A `url(#...)` reference cannot carry every character of the colour and the
// stops in the key, or the colons React puts in a generated id.
it('builds a reference with no characters a url cannot hold', () => {
  const tree = render(<Scrim color="#000000" stops={stops} />)

  const { fill } = tree.UNSAFE_getAllByType(Rect)[0].props

  expect(fill).toMatch(/^url\(#[A-Za-z0-9-]+\)$/)
})

it('renders one stop per entry', () => {
  const tree = render(
    <Scrim
      color="#101010"
      stops={[
        [0, 0],
        [0.5, 0.4],
        [1, 1],
      ]}
    />,
  )

  expect(tree.UNSAFE_getAllByType(Stop)).toHaveLength(3)
})

describe('a change of size', () => {
  const layout = (width: number, height: number) => ({
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  })
  const measured = (tree: ReturnType<typeof render>) =>
    tree.UNSAFE_root.findAll((node) => typeof node.props.onLayout === 'function')[0]

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // On Android the Svg kept the size of its first layout, so after a rotation
  // the gradient covered only part of the picture under it.
  it('draws the gradient again at the new size', () => {
    const tree = render(<Scrim color="#000000" stops={stops} />)
    fireEvent(measured(tree), 'layout', layout(411, 300))
    const before = tree.UNSAFE_getByType(Svg).instance

    fireEvent(measured(tree), 'layout', layout(731, 300))

    expect(tree.UNSAFE_getByType(Svg).instance).not.toBe(before)
  })

  // The first layout and a repeat of the same size cost no second mount.
  it('keeps the drawing while the size stays the same', () => {
    const tree = render(<Scrim color="#000000" stops={stops} />)
    const first = tree.UNSAFE_getByType(Svg).instance

    fireEvent(measured(tree), 'layout', layout(411, 300))
    fireEvent(measured(tree), 'layout', layout(411, 300))

    expect(tree.UNSAFE_getByType(Svg).instance).toBe(first)
  })

  // The web scales an `<svg>` with CSS, so it needs no measure.
  it('does not measure on the web', () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    const tree = render(<Scrim color="#000000" stops={stops} />)

    expect(measured(tree)).toBeUndefined()
  })
})
