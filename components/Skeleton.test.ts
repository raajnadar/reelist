import { skeletonCardCount } from './Skeleton'
import { CARD_WIDTH } from './MovieCard'

describe('skeletonCardCount', () => {
  it('fills a phone width', () => {
    // 390 - 32 padding = 358 usable, which holds two 160px cards and starts a
    // third. The third is what shows the row continues past the edge.
    expect(skeletonCardCount(390)).toBe(3)
  })

  /**
   * This is the regression guard for the bug the helper exists to fix: a fixed
   * count of 4 covered ~700px and left the rest of a desktop window empty, so
   * the skeleton read as a short row instead of a loading one.
   */
  it('fills a wide desktop window', () => {
    expect(skeletonCardCount(2880)).toBeGreaterThan(4)
  })

  it('adds cards as the window grows', () => {
    expect(skeletonCardCount(1600)).toBeGreaterThan(skeletonCardCount(800))
  })

  it('covers the full width at every size', () => {
    for (const width of [320, 390, 768, 1024, 1440, 2880]) {
      const covered = skeletonCardCount(width) * (CARD_WIDTH + 12)

      // The cards plus their gaps must reach the right edge, else a strip of
      // background is left bare.
      expect(covered).toBeGreaterThanOrEqual(width - 32)
    }
  })

  it('never renders an empty row before the first measurement', () => {
    // Native reports 0 on the first frame. A count of 0 would flash a bare
    // heading with no cards under it.
    expect(skeletonCardCount(0)).toBe(1)
    expect(skeletonCardCount(-100)).toBe(1)
  })
})
