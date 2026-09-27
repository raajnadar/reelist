const IMAGE_BASE = 'https://image.tmdb.org/t/p'

/**
 * TMDB returns a path fragment (`/abc.jpg`), not a URL. Pick the smallest size
 * that fits the slot — `original` is multiple megabytes per image and stalls a
 * horizontal row.
 */
export const posterUrl = (path: string | null, size: 'w342' | 'w500' = 'w342') =>
  path ? `${IMAGE_BASE}/${size}${path}` : null

/**
 * A backdrop, or any other landscape still.
 *
 * `w780` fills the masthead and a gallery thumbnail. `w1280` is for the viewer,
 * where the picture is the whole screen and a phone held sideways shows it at
 * over 800 points wide. `original` is left out on purpose: TMDB stores some
 * backdrops at 3840 wide, and that is megabytes per swipe.
 */
export const backdropUrl = (path: string | null, size: 'w780' | 'w1280' = 'w780') =>
  path ? `${IMAGE_BASE}/${size}${path}` : null

/**
 * A person's headshot. TMDB serves profile images from the same base, in its
 * own set of sizes: `w185` fills the cast card, and `h632` is the only larger
 * one TMDB offers for a profile.
 */
export const profileUrl = (path: string | null, size: 'w185' | 'h632' = 'w185') =>
  path ? `${IMAGE_BASE}/${size}${path}` : null
