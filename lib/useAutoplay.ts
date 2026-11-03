import { useAnimator, useMotionValue, useShouldReduceMotion } from '@rootnative/inertia'
import { cancelAnimation } from '@rootnative/inertia/reanimated'
import { useIsFocused } from 'expo-router'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { AUTOPLAY_MS, transitions } from './motion'

/**
 * Moves a carousel on by itself, one film each AUTOPLAY_MS.
 *
 * It holds while the reader uses the carousel: a finger on a card or on the
 * list, a mouse over a card, or keyboard focus inside it. On the web it also
 * holds while the list moves, so a step never starts from a list that is
 * still on its way to a film. A hold freezes the wait where it is, and the
 * end of the hold continues it, so a reader who holds a card can read its
 * caption for as long as they like and loses none of the time that was left.
 * The pause button freezes it the same way, until the reader starts it
 * again, which WCAG 2.2.2 asks of any content that moves by itself for more
 * than five seconds.
 *
 * A mouse over the backdrop, the caption, or the buttons does not hold. The
 * reader looks at the poster, so only the poster stops the carousel.
 *
 * It is off while another screen is on top, and when the system asks for
 * reduced motion. A new `active` starts a new wait, so a reader who swipes
 * gets the full time on the film they chose.
 *
 * `progress` is the wait as a share from 0 to 1, on the UI thread, for the
 * fill of the active dot. It stops when the wait stops.
 */
export function useAutoplay(available: boolean, active: number, advance: () => void) {
  const reduceMotion = useShouldReduceMotion()
  const onTop = useIsFocused()
  const [paused, setPaused] = useState(false)
  const [pointer, setPointer] = useState(false)
  const [keyboard, setKeyboard] = useState(false)
  const [drag, setDrag] = useState(false)
  const [press, setPress] = useState(false)
  const [moving, setMoving] = useState(false)

  const enabled = available && !reduceMotion
  const running =
    enabled && !paused && onTop && !pointer && !keyboard && !drag && !press && !moving
  const tick = useEffectEvent(advance)

  const progress = useMotionValue(0)
  const animate = useAnimator()
  // The milliseconds of the current wait that ran before the last hold.
  const elapsed = useRef(0)

  // Before the effect below, so that on a new film it starts from zero: React
  // runs the setups of one commit in the order they are written.
  useEffect(() => {
    elapsed.current = 0
    progress.set(0)
  }, [active, progress])

  useEffect(() => {
    if (!running) return
    const remaining = Math.max(AUTOPLAY_MS - elapsed.current, 0)
    const startedAt = Date.now()
    // The timer moves the carousel, and the fill only shows it. Both start
    // here with the same time left, so the fill is full when the timer fires.
    animate(progress, 1, { ...transitions.autoplay, duration: remaining })
    const timer = setTimeout(() => tick(), remaining)
    return () => {
      clearTimeout(timer)
      cancelAnimation(progress)
      elapsed.current = Math.min(elapsed.current + Date.now() - startedAt, AUTOPLAY_MS)
    }
  }, [running, active, progress, animate])

  return {
    enabled,
    paused,
    progress,
    togglePaused: () => setPaused((value) => !value),
    /** For the view around the carousel. */
    holdHandlers: {
      // Keyboard focus only. A click focuses the button it lands on, and a
      // hold on that focus would keep the carousel still after the reader
      // pressed play, until they clicked somewhere else.
      onFocus: (event: { target?: unknown }) => {
        const target = event.target as { matches?: (selector: string) => boolean }
        if (target?.matches?.(':focus-visible')) setKeyboard(true)
      },
      onBlur: () => setKeyboard(false),
    },
    /** For the list. */
    dragHandlers: {
      onScrollBeginDrag: () => setDrag(true),
      onScrollEndDrag: () => setDrag(false),
    },
    /**
     * For each card. A state setter, so its identity never changes and the
     * list does not render every card again when the carousel renders.
     */
    onCardHold: setPress,
    /** For each card, the same as `onCardHold`. */
    onCardHover: setPointer,
    /** On the web, for the list. See useWebListScroll. */
    onListMoving: setMoving,
  }
}
