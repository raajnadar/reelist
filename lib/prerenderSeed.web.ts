import data from './prerender.json'
import type { PrerenderSeed } from './prerender'

/**
 * The prerender seed. lib/prerender.json is written by
 * scripts/prerender-seed.js before the deploy exports the site. The tracked
 * copy is empty, so a local build and the tests see no seed. See
 * lib/prerender.ts for what the seed is for.
 */
export const seed = data as PrerenderSeed
