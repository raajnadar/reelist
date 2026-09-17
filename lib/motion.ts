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
   * The sweep that drives a scroll-triggered row. Timing, not spring, and this
   * is the one place the distinction is load-bearing: `cascadeWindow` cuts the
   * 0-1 sweep into one window per card, so a spring that overshoots past 1
   * would drive the late cards backwards before it settled.
   *
   * The duration covers the whole cascade, not one card. See cascadeWindow.
   */
  cascade: { type: 'timing', duration: 900 },

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
  // The empty body is the mechanism, not an oversight: the augmentation works by
  // extending Record with the transition names, and a member of its own would
  // add a key that is not one of them.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RegisteredTransitions extends Record<keyof typeof transitions, true> {}
}

/**
 * Milliseconds between consecutive lines in a staggered entrance.
 *
 * One value for the detail screen's two cascades — the loading blocks and the
 * content that replaces them — so the two read as the same movement. It sits
 * here rather than on the screen because the blocks it paces are components of
 * their own now, and a second copy of the number would let the two drift.
 */
export const STAGGER_INTERVAL = 60

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

/**
 * The slice of a row's 0-1 in-view sweep that belongs to card `index`.
 *
 * A row below the fold cannot stagger its cards with `delay`. The delay counts
 * from mount, and the cards mount with the screen — so by the time the user
 * scrolls down, every entrance has already finished off screen. `useInView`
 * fixes when the movement starts, but it reports one value for the whole row.
 *
 * Cutting that value into overlapping windows puts the stagger back: card 0
 * animates over the first half of the sweep, card 1 over a slightly later
 * half, and so on. `useInterpolatedStyle` clamps outside its input range, so a
 * card sits at its start value until its window opens and holds the end value
 * after it closes.
 *
 * The cap matches `stagger` above and is there for the same reason: without it
 * a row of twenty posters would spread the last window past the end of the
 * sweep, where it could never open.
 */
export function cascadeWindow(index: number, step = 0.08, span = 0.5, max = 6) {
  const start = Math.min(index, max) * step

  return [start, start + span] as const
}
