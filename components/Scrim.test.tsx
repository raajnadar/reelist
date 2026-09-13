import { render } from '@testing-library/react-native'
import { View } from 'react-native'
import { Rect, Stop } from 'react-native-svg'
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

// A `url(#...)` reference cannot carry the colons React puts in a generated id.
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
