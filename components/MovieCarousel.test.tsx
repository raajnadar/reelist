import { CAROUSEL_MAX_CARD_WIDTH, CAROUSEL_PEEK, CAROUSEL_SPACING } from './CarouselCard'
import { carouselGeometry as geometry } from './MovieCarousel'

// MovieCarousel states its geometry rule in a comment: the first card must sit
// under the viewport center, and the inset that puts it there must never grow
// so wide that the card floats alone in blank space. A comment cannot fail, so
// the rule is asserted here.
//
// The function comes from the component. An earlier version of this file
// recomputed the formula instead, which made the tests agree with themselves:
// they passed even when CAROUSEL_PEEK was changed to a value that clips the
// neighbouring card.

// A small phone, a large phone, a tablet, and a desktop browser.
const widths = [320, 390, 430, 768, 1024, 1440, 2000]

describe('carousel geometry', () => {
  // Below the ceiling the card is sized from the screen, so the inset is small
  // and centering is free. This is the case the cap must not disturb.
  it.each([320, 390, 430])('centers the card at width %i', (width) => {
    const { cardWidth, sidePadding, centerOffset } = geometry(width)
    expect(sidePadding * 2 + cardWidth).toBe(width)
    expect(centerOffset).toBe(0)
  })

  // Above the ceiling, centering would push the inset arbitrarily wide. The cap
  // is what stops the gap the screenshot showed at width 2000, where a centered
  // 320px card left 840px of empty space on each side.
  it.each([1024, 1440, 2000])('caps the inset instead of centering at width %i', (width) => {
    const { sidePadding } = geometry(width)
    expect(sidePadding).toBe(CAROUSEL_PEEK + CAROUSEL_SPACING)
  })

  // A capped inset moves slot 0 off the viewport center, so the interpolation
  // must move with it or every card peaks at the wrong scroll position.
  it.each(widths)('keeps the scale peak on the viewport center at width %i', (width) => {
    const { cardWidth, sidePadding, centerOffset } = geometry(width)
    // Slot 0's own center, in scroll coordinates, measured from the viewport
    // center. This is the value each card subtracts from its input range.
    expect(sidePadding + cardWidth / 2 + centerOffset).toBe(width / 2)
  })

  it.each(widths)('never lets the card exceed the ceiling at width %i', (width) => {
    expect(geometry(width).cardWidth).toBeLessThanOrEqual(CAROUSEL_MAX_CARD_WIDTH)
  })

  it('grows the card with the screen until it reaches the ceiling', () => {
    expect(geometry(320).cardWidth).toBeLessThan(geometry(390).cardWidth)
  })

  it('caps the card on a tablet, where the ceiling binds instead of the screen', () => {
    expect(geometry(1024).cardWidth).toBe(CAROUSEL_MAX_CARD_WIDTH)
  })

  // The peek is what the constant promises at every width: below the ceiling
  // the card is sized to leave exactly that much, and above it the cap holds
  // the inset at the same value. Anything narrower would clip the neighbour;
  // anything wider is the blank-space gap this cap exists to remove.
  it.each(widths)('shows the promised peek at width %i', (width) => {
    const { sidePadding } = geometry(width)
    expect(sidePadding - CAROUSEL_SPACING).toBe(CAROUSEL_PEEK)
  })

  // The constants themselves, asserted as numbers. Every test above recomputes
  // from them, so it cannot see a bad value: change CAROUSEL_PEEK to 8 and the
  // formulas still agree while the neighbouring card is clipped on screen.
  // These are the values the design was checked against.
  it('keeps the peek wide enough to read as a neighbouring card', () => {
    expect(CAROUSEL_PEEK).toBe(48)
    expect(CAROUSEL_SPACING).toBe(16)
    expect(CAROUSEL_MAX_CARD_WIDTH).toBe(320)
  })

  it('keeps the snap pitch equal to one slot', () => {
    const { cardWidth, snap } = geometry(390)
    expect(snap).toBe(cardWidth + CAROUSEL_SPACING)
  })
})
