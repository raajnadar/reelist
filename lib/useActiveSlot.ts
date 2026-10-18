import { useState } from 'react'
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

/**
 * The index of the scroll stop nearest the scroll offset, as React state.
 *
 * Every scroll-linked layer reads `scrollX` on the UI thread and needs no
 * state. This is for the choices only React can make: which layers to mount,
 * and when a button is disabled. Inertia has no hook that brings a shared
 * value back to the JS thread, so the reaction comes from Reanimated.
 *
 * The reaction sends the index across only when it changes, so a swipe
 * renders the parent once per slot, not once per frame.
 *
 * `initial` is the slot the list opens on. Until the first reaction, the
 * layers mount for that slot, not for slot 0.
 */
export function useActiveSlot(
  scrollX: SharedValue<number>,
  snap: number,
  count: number,
  initial = 0,
) {
  const [active, setActive] = useState(initial)

  useAnimatedReaction(
    // No pitch is the static web page before hydration. See CarouselStill.
    () =>
      snap > 0
        ? Math.min(Math.max(Math.round(scrollX.value / snap), 0), Math.max(count - 1, 0))
        : initial,
    (next, previous) => {
      if (next !== previous) scheduleOnRN(setActive, next)
    },
    [snap, count, initial],
  )

  // A shorter list can arrive under a stale index, before the reaction runs.
  return Math.min(active, Math.max(count - 1, 0))
}

/**
 * The active slot and its neighbours, inside the list. A layer that follows
 * the scroll only shows near the center, so these are the only slots that
 * need one mounted.
 */
export function nearSlots(active: number, count: number) {
  return [active - 1, active, active + 1].filter((slot) => slot >= 0 && slot < count)
}
