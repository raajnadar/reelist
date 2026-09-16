import { CARD_WIDTH } from '../components/MovieCard'

/**
 * The poster grid, shared by search, genre, and the watchlist.
 *
 * The three screens draw the same thing: a set of films to scan, rather than a
 * shelf to browse. Holding the numbers in one place is what keeps the gap
 * between two cards on one screen equal to the gap on another.
 */

/** The space between two cards, across and down. */
export const GRID_GAP = 12

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
