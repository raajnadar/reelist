import type { View } from 'react-native'

/** A box in window coordinates: where a view is drawn on the screen. */
export type Rect = { x: number; y: number; width: number; height: number }

/**
 * Where the search button was when the reader pressed it.
 *
 * The search screen is a transparent modal that opens over the screen with the
 * button. Its field starts as a pill drawn over that button and flies to the
 * top of the window, so the modal has to know where the button is. A route
 * param would carry the box, but it would also put four numbers in the web URL
 * and make them part of every deep link. The button writes the box here
 * instead, and the modal reads it when it mounts.
 *
 * One value, not a map: only one search can be open at a time.
 */
let origin: Rect | null = null

export function setSearchOrigin(rect: Rect): void {
  origin = rect
}

/**
 * The box the last press stored, or null when the modal opened some other way,
 * such as a deep link straight to /search.
 *
 * Reading does not clear. The modal clears in an effect after its first
 * render, so a second render of the same mount — React Strict Mode does one on
 * purpose — still finds the box.
 */
export function readSearchOrigin(): Rect | null {
  return origin
}

export function clearSearchOrigin(): void {
  origin = null
}

/**
 * The box of `node` in window coordinates, or null when there is no node.
 *
 * `measureInWindow` answers through a callback, and on the web it answers on a
 * later tick. The promise lets the caller push the route after the answer is
 * in rather than before, which is the order the modal needs: it reads the box
 * when it mounts.
 */
export function measureWindowRect(node: View | null): Promise<Rect | null> {
  if (!node) return Promise.resolve(null)

  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }))
  })
}
