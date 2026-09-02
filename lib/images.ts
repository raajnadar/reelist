const IMAGE_BASE = 'https://image.tmdb.org/t/p'

/**
 * TMDB returns a path fragment (`/abc.jpg`), not a URL. Pick the smallest size
 * that fits the slot — `original` is multiple megabytes per image and stalls a
 * horizontal row.
 */
export const posterUrl = (path: string | null, size: 'w342' | 'w500' = 'w342') =>
  path ? `${IMAGE_BASE}/${size}${path}` : null

export const backdropUrl = (path: string | null) =>
  path ? `${IMAGE_BASE}/w780${path}` : null

/**
 * A person's headshot. TMDB serves profile images from the same base, in its
 * own set of sizes: `w185` fills the cast card, and `h632` is the only larger
 * one TMDB offers for a profile.
 */
export const profileUrl = (path: string | null, size: 'w185' | 'h632' = 'w185') =>
  path ? `${IMAGE_BASE}/${size}${path}` : null
