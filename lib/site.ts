import { defineSite, type PageMeta } from '@rootnative/seo'

/**
 * The public address of the web build, with no trailing slash.
 *
 * A shared link points here on every platform, not at the `reelist://` scheme.
 * A web link opens for a reader who does not have the app, and the same page
 * carries the meta tags a crawler reads. The scheme link does neither.
 */
export const SITE_URL = 'https://reelist.raajnadar.in'

/**
 * The site every `PageHead` reads through the `SeoProvider` in app/_layout.tsx.
 *
 * The tab title adds ` · Reelist`, and the Open Graph title does not, because
 * the card shows the site name on a line of its own. `toHeadTags` clips each
 * description to 160 characters, so lib/head.ts passes the full text.
 *
 * Apart from lib/head.ts, because the root layout imports this file, and the
 * page builders in lib/head.ts stay out of the entry bundle.
 *
 * This file imports nothing from react-native, on purpose:
 * scripts/not-found-head.js loads it in plain Node after the web export.
 */
export const site = defineSite({
  name: 'Reelist',
  url: SITE_URL,
  locale: 'en_US',
  titleTemplate: (title) => `${title} · Reelist`,
})

/**
 * The head of the not-found page. Here, not in lib/head.ts, because the export
 * writes no head for the not-found route and scripts/not-found-head.js writes
 * this one into the file.
 */
export const notFoundMeta: PageMeta = { title: 'Page not found', noindex: true }
