import { useId } from 'react'
import { StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

/**
 * One stop of the gradient: how far down the box it sits (0 to 1) and how
 * opaque the colour is there.
 */
export type ScrimStop = readonly [offset: number, opacity: number]

/**
 * A vertical gradient that fills its parent.
 *
 * This is how a photo dissolves into the page instead of ending at a hard
 * edge. The parent owns the position and the size; the scrim only paints, and
 * it never takes a touch.
 *
 * `react-native-svg` draws it because the project has no gradient library:
 * `expo-linear-gradient` was removed, and the SVG package is already a
 * dependency (components/BrandMark.tsx draws with it).
 *
 * Every stop carries the same `color` at a different opacity. A gradient from a
 * named colour to `transparent` is the common alternative, and it is wrong on
 * Android: `transparent` is black at zero alpha there, so the middle of the
 * sweep turns grey.
 */
export function Scrim({ color, stops }: { color: string; stops: readonly ScrimStop[] }) {
  // Two scrims render on the detail screen, and on web they become two real
  // `<svg>` elements in one document. A fixed id would make the second
  // definition win for both, so each instance names its own.
  //
  // `useId` returns a value with colons (`:r0:`), which a `url(#...)` reference
  // cannot carry, so the separators are dropped.
  const gradientId = `scrim-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <Svg style={styles.scrim}>
      <Defs>
        {/* x1 = x2 and y1 -> y2 is the vertical sweep, top to bottom. */}
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          {stops.map(([offset, opacity]) => (
            <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  )
}

const styles = StyleSheet.create({
  // `pointerEvents` sits in the style rather than in a prop of the same name:
  // React Native deprecated the prop form, and react-native-web reports it on
  // every render.
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
})
