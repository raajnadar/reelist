import { defineSite } from '@rootnative/seo'
import { SITE_URL } from './share'

/**
 * The site every `PageHead` reads through the `SeoProvider` in app/_layout.tsx.
 *
 * The tab title adds ` · Reelist`, and the Open Graph title does not, because
 * the card shows the site name on a line of its own. `toHeadTags` clips each
 * description to 160 characters, so lib/head.ts passes the full text.
 *
 * Apart from lib/head.ts, because the root layout imports this file, and the
 * page builders in lib/head.ts stay out of the entry bundle.
 */
export const site = defineSite({
  name: 'Reelist',
  url: SITE_URL,
  locale: 'en_US',
  titleTemplate: (title) => `${title} · Reelist`,
})
