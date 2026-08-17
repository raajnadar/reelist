import type { TransitionConfig } from '@rootnative/inertia'

/**
 * The motion vocabulary for the app.
 *
 * These names are registered once on `<MotionConfig transitions>` in
 * app/_layout.tsx. A component then writes `transition="press"` instead of
 * repeating a spring config, so the feel of every surface changes from this
 * file alone.
 *
 * Inertia uses react-spring vocabulary: `tension` is the pull toward the
 * target, `friction` is the damping. Reanimated's raw `stiffness` / `damping`
 * never appear in the public API.
 */
export const transitions = {
  /**
   * Touch and pointer feedback. Fast and slightly springy, so a tap feels
   * answered rather than animated. Anything slower reads as lag on press.
   */
  press: { type: 'spring', tension: 420, friction: 22 },

  /**
   * Hover on web. Timing, not spring: a pointer can cross a card in a few
   * frames, and a spring left mid-flight on every crossing looks unsettled.
   */
  hover: { type: 'timing', duration: 140 },

  /**
   * Content arriving on screen — a card, a row, a hero. Low tension gives the
   * slow settle that makes an entrance read as deliberate.
   */
  enter: { type: 'spring', tension: 120, friction: 20 },

  /**
   * Content leaving. Timing and quick: an exit that springs holds the old
   * content on screen while the new content is already arriving.
   */
  exit: { type: 'timing', duration: 180 },

  /**
   * The skeleton shimmer. One sweep of the placeholder highlight; the caller
   * adds `repeat: 'infinite'`.
   */
  shimmer: { type: 'timing', duration: 1100 },
} satisfies Record<string, TransitionConfig>

/**
 * Compile-time narrowing for `transition="..."`. Without this the prop accepts
 * any string and a typo falls through to a dev-time warning at runtime.
 */
declare module '@rootnative/inertia' {
  interface RegisteredTransitions extends Record<keyof typeof transitions, true> {}
}

/**
 * Entrance delay for item `index`, in milliseconds.
 *
 * The stagger is capped: with 20 posters in a row, a flat `index * step` would
 * leave the last card arriving a second and a half after the first, long after
 * the user started scrolling. The cap keeps the effect on the cards that are
 * visible at mount and lets the rest appear immediately.
 */
export function stagger(index: number, step = 55, max = 6) {
  return Math.min(index, max) * step
}

/**
 * The entrance transition for item `index`, spread across the properties an
 * entrance animates.
 *
 * A `transition` object is EITHER one config OR a per-key map — Inertia tells
 * them apart by testing whether every key is a config field. So a component
 * that animates an entrance AND declares a `gesture` layer cannot put the
 * entrance spring at the top level: the object already has a `pressed` key,
 * which makes it a map, and a stray `type: 'spring'` beside it is then read as
 * a transition *name*. That lookup misses and falls back to the default
 * spring, losing the tuning below without failing.
 *
 * Spreading this into the map keeps the entrance on the keys it belongs to and
 * leaves the gesture layers free to answer a touch immediately.
 */
export function entranceTransition(index: number) {
  const config = { ...transitions.enter, delay: stagger(index) } as const

  return { opacity: config, translateY: config }
}
