import { CAROUSEL_MAX_CARD_WIDTH, CAROUSEL_PEEK, CAROUSEL_SPACING } from './CarouselCard'
import { carouselGeometry as geometry } from './MovieCarousel'

// MovieCarousel states its geometry rule in a comment: the centering inset must
// stay (width - card) / 2, or the centered card is no longer centered and every
// scale peak drifts off the viewport center. A comment cannot fail, so the rule
// is asserted here.
//
// The function comes from the component. An earlier version of this file
// recomputed the formula instead, which made the tests agree with themselves:
// they passed even when CAROUSEL_PEEK was changed to a value that clips the
// neighbouring card.

// A small phone, a large phone, and a tablet.
const widths = [320, 390, 430, 768, 1024]

describe('carousel geometry', () => {
  it.each(widths)('centers the card at width %i', (width) => {
    const { cardWidth, sidePadding } = geometry(width)
    // The card plus both insets must fill the screen exactly. This is the
    // invariant the comment states.
    expect(sidePadding * 2 + cardWidth).toBe(width)
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

  // Below the ceiling the peek is exactly what the constant promises. Above it
  // the card stops growing, so the leftover space makes the peek wider — never
  // narrower, which is the direction that would clip the neighbour.
  it.each(widths)('shows at least the promised peek at width %i', (width) => {
    const { sidePadding } = geometry(width)
    expect(sidePadding - CAROUSEL_SPACING).toBeGreaterThanOrEqual(CAROUSEL_PEEK)
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
