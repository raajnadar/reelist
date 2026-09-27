/**
 * The colours of a screen that shows a picture or a video and nothing else.
 *
 * Black in both themes, and deliberately not a theme colour. Every player and
 * every photo viewer puts its frame on black, and a light surface beside a
 * bright frame reads as a fault in the picture rather than as the page behind
 * it. The trailer screen and the gallery viewer share these, so the two cannot
 * drift apart.
 */
export const STAGE = '#000000'

/** White on that stage, for the same reason: the controls are not a themed surface. */
export const ON_STAGE = '#FFFFFF'
