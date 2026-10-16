const IMAGE_BASE = 'https://image.tmdb.org/t/p'

/**
 * The pixel size of a file, from the TMDB ratios: a backdrop is 16:9, and a
 * poster or a profile is 2:3. The `w` and `h` sizes fix one side. The share
 * tags in lib/head.ts and the web `<img>` in RemoteImage read them.
 */
export type ImageSize = { width: number; height: number }

export const BACKDROP_W780: ImageSize = { width: 780, height: 439 }
export const POSTER_W342: ImageSize = { width: 342, height: 513 }
export const POSTER_W500: ImageSize = { width: 500, height: 750 }
export const PROFILE_H632: ImageSize = { width: 421, height: 632 }

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

/**
 * A streaming service logo. TMDB serves logos from the same base, square, in
 * its own set of sizes. `w92` fills the tile in the watch providers row at
 * twice its point size.
 */
export const logoUrl = (path: string | null, size: 'w92' | 'w154' = 'w92') =>
  path ? `${IMAGE_BASE}/${size}${path}` : null
