import Head from 'expo-router/head'
import { documentTitle, type PageMeta } from '../lib/head'

/**
 * The document head for one screen on the web: the tab title, the
 * description, the canonical link, and the Open Graph and Twitter cards a
 * share unfurls. lib/head.ts builds the props for each kind of page.
 *
 * For a page the static export writes, these tags are in the HTML, so a
 * crawler that reads no JavaScript gets them. For every other page the
 * browser writes them after the data loads, and only a crawler that runs
 * JavaScript reads them. See lib/prerender.ts.
 *
 * `noindex` is for an overlay: the search sheet, the watchlist, the about
 * sheet, the trailer, and the gallery. Each is a view over a film or over the
 * home page, or a list that lives on one device, and none of them is a result
 * a reader searches for. The tag keeps them out of the index while the pages
 * they open from stay in it. public/robots.txt must not disallow them, because
 * a crawler reads the tag only on a page it may fetch.
 */
export function PageHead({ title, description, url, image, type, noindex }: PageMeta) {
  return (
    <Head>
      <title>{documentTitle(title)}</title>
      {description ? <meta name="description" content={description} /> : null}
      {noindex ? <meta name="robots" content="noindex" /> : null}
      {url ? <link rel="canonical" href={url} /> : null}

      {url ? <meta property="og:type" content={type ?? 'website'} /> : null}
      {url ? <meta property="og:site_name" content="Reelist" /> : null}
      {url ? <meta property="og:title" content={title} /> : null}
      {url && description ? (
        <meta property="og:description" content={description} />
      ) : null}
      {url ? <meta property="og:url" content={url} /> : null}
      {url && image ? <meta property="og:image" content={image} /> : null}

      {url ? (
        <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      ) : null}
      {url ? <meta name="twitter:title" content={title} /> : null}
      {url && description ? (
        <meta name="twitter:description" content={description} />
      ) : null}
      {url && image ? <meta name="twitter:image" content={image} /> : null}
    </Head>
  )
}
