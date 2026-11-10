import type { ViewStyle } from 'react-native'

/**
 * Keeps an element for the screen reader and out of sight. A screen whose bar
 * carries no `<h1>` gives one to the reader this way.
 *
 * Not `display: 'none'`, which hides it from the reader too, and not a zero
 * size, which some readers skip. One point, clipped, and transparent.
 */
export const visuallyHidden: ViewStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  opacity: 0,
  pointerEvents: 'none',
}
