import { CARD_WIDTH } from '../components/MovieCard'
import { LIFT_SPACE } from './motion'

/**
 * The poster grid, shared by search, genre, and the watchlist.
 *
 * The three screens draw the same thing: a set of films to scan, rather than a
 * shelf to browse. Holding the numbers in one place is what keeps the gap
 * between two cards on one screen equal to the gap on another.
 */

/**
 * The space between two cards, across and down.
 *
 * It is LIFT_SPACE, not a number of its own: a card under the pointer grows and
 * rises, and a gap narrower than that would let it draw over the card in the
 * row above. The same value runs across as well, so the grid stays a grid.
 */
export const GRID_GAP = LIFT_SPACE

/** The space between the grid and the edge of the screen. */
export const GRID_PADDING = 16

/**
 * How many poster columns fit in `width`.
 *
 * Derived from the window so one layout serves a phone and a desktop browser;
 * a fixed count would leave a wide window mostly empty.
 *
 * Two is the floor. One column on a narrow window would give each poster the
 * full width, which reads as a list of billboards instead of a grid, so a very
 * narrow window is allowed to overflow rather than drop to one.
 */
export function posterColumns(width: number): number {
  const available = width - GRID_PADDING * 2
  return Math.max(2, Math.floor((available + GRID_GAP) / (CARD_WIDTH + GRID_GAP)))
}

/**
 * The space on each side of the grid in `width`, so the grid sits centred.
 *
 * The cards have a fixed width, so the columns rarely fill the window. With a
 * fixed padding every leftover point went to the right: on a 393 phone the
 * two columns left 16 on the left and 41 on the right. Splitting the leftover
 * puts the same margin on both sides, while the rows inside stay left
 * aligned, so a last row with one card starts under the first column rather
 * than floating in the middle.
 *
 * Never less than GRID_PADDING: two columns is a floor, and a window too
 * narrow for them must not pull the grid past its own edge.
 */
export function gridInset(width: number): number {
  const columns = posterColumns(width)
  const used = columns * CARD_WIDTH + (columns - 1) * GRID_GAP
  return Math.max(GRID_PADDING, Math.floor((width - used) / 2))
}
