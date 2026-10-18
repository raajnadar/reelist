import {
  CAROUSEL_MAX_CARD_WIDTH,
  CAROUSEL_MIN_CARD_WIDTH,
  CAROUSEL_PEEK,
  CAROUSEL_POSTER_SHARE,
  CAROUSEL_SPACING,
} from './CarouselCard'
import { carouselGeometry as geometry, loopLayout } from './MovieCarousel'

// MovieCarousel states its geometry rules in comments: slot `n` is centred at
// scroll `n * snap`, the card leaves a peek of the next one, and the poster
// leaves room for the caption and the next row. The loop starts the reader in
// the middle with copies on both sides. A comment cannot fail, so the rules
// are asserted here.
//
// The functions come from the component. An earlier version of this file
// recomputed the formula instead, which made the tests agree with themselves:
// they passed even when CAROUSEL_PEEK was changed to a value that clips the
// neighbouring card.

// A small phone, two large phones, a tablet each way, a laptop, a desktop
// browser, and a phone held sideways.
const windows: [number, number][] = [
  [320, 568],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [2000, 1250],
  [844, 390],
]

describe('carousel geometry', () => {
  it.each(windows)('centres slot 0 at scroll 0 in a %i by %i window', (width, height) => {
    const { cardWidth, centerPadding } = geometry(width, height)
    expect(centerPadding + cardWidth / 2).toBeCloseTo(width / 2)
  })

  it.each(windows)(
    'shows at least the promised peek in a %i by %i window',
    (width, height) => {
      const { centerPadding } = geometry(width, height)
      expect(centerPadding - CAROUSEL_SPACING).toBeGreaterThanOrEqual(CAROUSEL_PEEK)
    },
  )

  it.each(windows)(
    'never lets the card exceed the ceiling in a %i by %i window',
    (width, height) => {
      expect(geometry(width, height).cardWidth).toBeLessThanOrEqual(
        CAROUSEL_MAX_CARD_WIDTH,
      )
    },
  )

  // The poster gives way to the caption and to the next row. The floor is the
  // one case where it may take more of the height.
  it.each(windows)(
    'keeps the poster to its share of a %i by %i window',
    (width, height) => {
      const { cardWidth } = geometry(width, height)
      if (cardWidth > CAROUSEL_MIN_CARD_WIDTH) {
        expect(cardWidth * 1.5).toBeLessThanOrEqual(height * CAROUSEL_POSTER_SHARE)
      }
    },
  )

  it('keeps a usable card in a phone held sideways', () => {
    expect(geometry(844, 390).cardWidth).toBe(CAROUSEL_MIN_CARD_WIDTH)
  })

  it('keeps the snap pitch equal to one slot', () => {
    const { cardWidth, snap } = geometry(390, 844)
    expect(snap).toBe(cardWidth + CAROUSEL_SPACING)
  })

  // The constants themselves, asserted as numbers. Every test above recomputes
  // from them, so it cannot see a bad value: change CAROUSEL_PEEK to 8 and the
  // formulas still agree while the neighbouring card is clipped on screen.
  // These are the values the design was checked against.
  it('keeps the constants the design was checked against', () => {
    expect(CAROUSEL_PEEK).toBe(48)
    expect(CAROUSEL_SPACING).toBe(16)
    expect(CAROUSEL_MAX_CARD_WIDTH).toBe(320)
    expect(CAROUSEL_MIN_CARD_WIDTH).toBe(180)
    expect(CAROUSEL_POSTER_SHARE).toBe(0.45)
  })
})

describe('carousel loop', () => {
  // The slot the reader starts on must show the first film, or the carousel
  // opens on a film from the middle of the list.
  it.each([2, 3, 20])('starts on the first film with %i films', (count) => {
    const { start } = loopLayout(count)
    expect(start % count).toBe(0)
  })

  // The loop has an end, but it must be too far away to reach: the step that
  // jumps back to the middle is the only thing that ever sees it.
  it.each([2, 20])('puts an end at least fifty copies away with %i films', (count) => {
    const { total, start } = loopLayout(count)
    expect(start / count).toBeGreaterThanOrEqual(50)
    expect((total - start) / count).toBeGreaterThanOrEqual(50)
  })

  it('holds whole copies, so every slot maps to one film', () => {
    const { total } = loopLayout(20)
    expect(total % 20).toBe(0)
  })

  it('does not loop one film', () => {
    expect(loopLayout(1)).toEqual({ total: 1, start: 0 })
  })
})
