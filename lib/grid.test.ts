import { CARD_WIDTH } from '../components/MovieCard'
import { GRID_GAP, GRID_PADDING, posterColumns } from './grid'

// The widths of the devices and windows the app is used on, from the narrowest
// phone to a desktop browser.
const WIDTHS = [320, 360, 390, 414, 768, 1024, 1440]

// One rule for three screens now. These were two copies of the same suite, one
// under search and one under genre, before lib/grid.ts held the maths.
describe('posterColumns', () => {
  it.each(WIDTHS)('gives at least 2 columns at %ipx', (width) => {
    expect(posterColumns(width)).toBeGreaterThanOrEqual(2)
  })

  it('never lays out columns wider than the available space', () => {
    for (const width of WIDTHS) {
      const columns = posterColumns(width)
      const needed = columns * CARD_WIDTH + (columns - 1) * GRID_GAP
      // Two columns is a floor, so a very narrow window is allowed to overflow.
      // Past that, the count must actually fit.
      if (columns > 2) {
        expect(needed).toBeLessThanOrEqual(width - GRID_PADDING * 2)
      }
    }
  })

  it('adds columns as the window widens', () => {
    expect(posterColumns(1440)).toBeGreaterThan(posterColumns(390))
  })
})
