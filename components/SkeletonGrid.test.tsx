import { renderWithProviders } from '../lib/test-utils'
import { gridInset, posterColumns } from '../lib/grid'
import { SkeletonGrid } from './Skeleton'

/**
 * The placeholder grid lays out in the geometry of the results grid: the
 * column count and the inset of lib/grid.ts at the width it is given. That
 * is the behaviour worth pinning. An earlier version resolved its columns
 * from a breakpoint map and stretched each card to its cell, and the results
 * then jumped in by 17 points on a phone when they replaced it.
 */

/** Renders at `width` and reports the card count and the inset. */
function gridAt(width: number, rows?: number) {
  const screen = renderWithProviders(<SkeletonGrid width={width} rows={rows} />)
  const grid = screen.getByTestId('skeleton-grid')
  const style = Object.assign({}, ...[grid.props.style].flat(9)) as {
    paddingHorizontal?: number
  }
  // One poster box per card, so the count of the ratio is the count of cards.
  const cards = JSON.stringify(screen.toJSON()).split('aspectRatio').length - 1
  return { cards, inset: style.paddingHorizontal }
}

describe('SkeletonGrid', () => {
  // The widths of the devices and windows the app is used on, and the
  // content widths a rail or a drawer leaves beside it.
  it.each([320, 390, 700, 900, 1024, 1300, 1700])(
    'lays out the columns and the inset of the results grid at %i',
    (width) => {
      const { cards, inset } = gridAt(width)
      expect(cards).toBe(posterColumns(width) * 2)
      expect(inset).toBe(gridInset(width))
    },
  )

  it('honours an explicit row count', () => {
    // Two columns at 390, so three rows is six cards.
    expect(gridAt(390, 3).cards).toBe(6)
  })
})
