import { turnBar } from './floatingBar'

const END = 1000

/**
 * Runs a scroll through `turnBar`, one event for each offset, and returns the
 * size of the bar after the last one.
 */
function sizeAfter(offsets: number[], end = END) {
  let size: 0 | 1 = 0
  let travel = 0
  let previous = 0
  for (const offset of offsets) {
    const turn = turnBar(previous, offset, travel, end)
    travel = turn.travel
    if (turn.size !== null) size = turn.size
    previous = offset
  }
  return size
}

describe('turnBar', () => {
  it('shrinks the bar once the content scrolls down far enough', () => {
    expect(sizeAfter([10])).toBe(0)
    expect(sizeAfter([10, 40])).toBe(1)
  })

  it('grows the bar again on a scroll up', () => {
    expect(sizeAfter([100, 200, 170])).toBe(0)
  })

  // A finger at rest moves the content by a few points. The bar must not
  // flip on that.
  it('holds its size through a short turn of direction', () => {
    expect(sizeAfter([100, 200, 190])).toBe(1)
    // Down again: the short turn up started the travel over.
    expect(sizeAfter([100, 200, 190, 210])).toBe(1)
  })

  it('grows the bar at the top of the content, and on the bounce past it', () => {
    expect(sizeAfter([100, 200, 0])).toBe(0)
    expect(sizeAfter([100, 200, -20])).toBe(0)
  })

  // An iOS fling bounces past the end and back. Without the hold at the end,
  // the way back reads as a scroll up, and the bar grows at the bottom of
  // every list.
  it('keeps the bar small through the bounce at the end', () => {
    expect(sizeAfter([600, 900, 1000, 1080, 1040, 1000])).toBe(1)
  })

  it('grows the bar on a real scroll up from the end', () => {
    expect(sizeAfter([600, 900, 1000, 1080, 1000, 960])).toBe(0)
  })

  it('counts every offset when the end is not known', () => {
    expect(sizeAfter([600, 900, 1080, 1040], Infinity)).toBe(0)
  })
})
