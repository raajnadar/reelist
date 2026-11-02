import { useIsFocused } from 'expo-router'
import { createContext, useContext, useEffect } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'

/**
 * The scroll travel, in points, in one direction that turns the bar. Short, so
 * the bar answers the first flick, and long enough that the small movement of
 * a finger at rest does not flip it.
 */
const TURN_DISTANCE = 24

/**
 * The size the floating navigation bar moves to: 0 is full, 1 is small.
 * AppNavigation owns it and springs the bar toward it. Null where no floating
 * bar shrinks: beside the rail or the drawer, under a screen reader, and in a
 * screen test with no navigation around it.
 */
export const BarShrinkContext = createContext<SharedValue<number> | null>(null)

export type BarTurn = {
  /** The travel in the current direction: positive down, negative up. */
  travel: number
  /** The size the bar takes now, or null to keep the size it has. */
  size: 0 | 1 | null
}

/**
 * One scroll event's effect on the bar, from the offset before it, the
 * offset after it, and the travel so far.
 *
 * Both offsets are held at `end`, the largest offset the content can rest
 * at. An iOS fling bounces past the end and back, and the way back is not a
 * scroll up: without the hold, the bar grows at the bottom of every list. A
 * turn of direction starts the travel again, so the bar waits for
 * `TURN_DISTANCE` of the new direction. At or above the top the bar is
 * always full.
 */
export function turnBar(
  previous: number,
  offset: number,
  travel: number,
  end: number,
): BarTurn {
  'worklet'
  if (offset <= 0) return { travel: 0, size: 0 }
  const delta = Math.min(offset, end) - Math.min(previous, end)
  const sum = delta * travel < 0 ? delta : travel + delta
  if (sum > TURN_DISTANCE) return { travel: sum, size: 1 }
  if (sum < -TURN_DISTANCE) return { travel: sum, size: 0 }
  return { travel: sum, size: null }
}

/**
 * Inertia's `useScroll`, for a screen under the floating navigation bar: the
 * same `scrollY` and `onScroll`, and the bar shrinks while the reader scrolls
 * the screen down and grows again on a scroll up.
 *
 * A handler of its own, not a reaction on the offset from `useScroll`: the
 * end of the content comes only with the scroll event, and Inertia keeps the
 * end it records to itself (DX feedback R45). Inertia's `useHideOnScroll` is
 * not used either. Its progress follows each point of the scroll and keeps
 * its own state, and the bar needs two sizes and a reset when the reader goes
 * to another page.
 *
 * Only the screen in front writes: the stack keeps the screens under it
 * mounted, and a fling that runs on after a push must not shrink the bar of
 * the next page.
 */
export function useBarScroll() {
  const shrink = useContext(BarShrinkContext)
  const focused = useIsFocused()
  const front = useSharedValue(focused)
  useEffect(() => {
    front.set(focused)
  }, [front, focused])

  const scrollY = useSharedValue(0)
  const travel = useSharedValue(0)

  const handler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet'
      const previous = scrollY.get()
      const offset = event.contentOffset.y
      scrollY.set(offset)
      if (!shrink || !front.get()) return
      // A test event can carry the offset alone. The end is then unknown, and
      // nothing is held.
      const end =
        event.contentSize && event.layoutMeasurement
          ? Math.max(
              0,
              event.contentSize.height +
                (event.contentInset?.bottom ?? 0) -
                event.layoutMeasurement.height,
            )
          : Infinity
      const turn = turnBar(previous, offset, travel.get(), end)
      travel.set(turn.travel)
      if (turn.size !== null) shrink.set(turn.size)
    },
  })

  // The handler is a Reanimated worklet bag, not a function. The cast is the
  // one Inertia's `useScroll` makes, so the prop types of `Motion.ScrollView`
  // and `Motion.FlatList` accept it.
  return {
    scrollY,
    onScroll: handler as unknown as (
      event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => void,
  }
}
