import type { PrerenderSeed } from './prerender'

/**
 * The prerender seed. Empty on native: the seed exists so a crawler gets a
 * film's text in the static HTML, and a native build has no HTML. The web
 * version, in prerenderSeed.web.ts, reads lib/prerender.json.
 *
 * Only a type comes from lib/prerender.ts. A value would make the two files a
 * cycle, and the one loaded second would see undefined.
 */
export const seed: PrerenderSeed = {
  movies: {},
  lists: { trending: [], popular: [], topRated: [] },
  genres: [],
}
