import { Dimensions } from 'react-native'
import { renderWithProviders } from '../lib/test-utils'
import { SkeletonGrid } from './Skeleton'

/**
 * The placeholder grid gets its column count from a breakpoint map that
 * `Grid` and `useBreakpointValue` resolve, not from a measured card width.
 * That is a behaviour worth pinning: nothing in the component states the
 * resolved number, so a wrong map or a wrong cascade is invisible in review.
 *
 * The assertions read the `flexBasis` that Grid writes onto each cell, which
 * is the library's own output rather than a restatement of the map.
 */

/** Renders at `width` and reports what Grid put on the cells. */
function cellsAt(width: number) {
  const spy = jest.spyOn(Dimensions, 'get').mockReturnValue({
    width,
    height: 844,
    scale: 2,
    fontScale: 2,
  } as never)

  const json = renderWithProviders(<SkeletonGrid />).toJSON()
  const bases: string[] = []

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { props?: { style?: unknown }; children?: unknown[] }
    const style = n.props?.style
    const flat = Array.isArray(style) ? (style.flat(9) as unknown[]) : [style]
    for (const entry of flat) {
      const basis = (entry as { flexBasis?: string } | null)?.flexBasis
      if (basis) bases.push(String(basis))
    }
    n.children?.forEach(walk)
  }

  ;(Array.isArray(json) ? json : [json]).forEach(walk)
  spy.mockRestore()

  // Every cell shares one flexBasis, so the set size is the column count and
  // the list length is the number of cards.
  return { count: bases.length, columns: Math.round(100 / parseFloat(bases[0])) }
}

describe('SkeletonGrid', () => {
  // The MD3 window size classes the map names: compact 0, medium 600,
  // expanded 840, large 1200. 1700 is extraLarge, which has no entry and must
  // cascade down to large.
  it.each([
    [390, 2],
    [700, 3],
    [900, 4],
    [1300, 6],
    [1700, 6],
  ])('resolves %i wide to %i columns', (width, expected) => {
    expect(cellsAt(width).columns).toBe(expected)
  })

  /**
   * The regression guard for what the breakpoint map replaced.
   *
   * An earlier version rendered a fixed worst-case card count and let
   * `overflow: 'hidden'` clip the surplus, which built six rows on a phone to
   * show two. The count must follow the column count so every width renders
   * the same two rows.
   */
  it.each([390, 700, 900, 1300, 1700])(
    'renders exactly two rows at width %i',
    (width) => {
      const { count, columns } = cellsAt(width)
      expect(count).toBe(columns * 2)
    },
  )

  it('honours an explicit row count', () => {
    const spy = jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 390,
      height: 844,
      scale: 2,
      fontScale: 2,
    } as never)
    const screen = renderWithProviders(<SkeletonGrid rows={3} />)
    spy.mockRestore()
    // Two columns at 390, so three rows is six cards. Asserted through the
    // poster blocks rather than the cells, to prove the cards themselves scale.
    expect(JSON.stringify(screen.toJSON()).split('aspectRatio').length - 1).toBe(6)
  })
})
