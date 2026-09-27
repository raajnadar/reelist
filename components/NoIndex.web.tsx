import Head from 'expo-router/head'

/**
 * Tells a search engine not to index the screen.
 *
 * For an overlay: the search sheet, the watchlist, the about sheet, the
 * trailer, and the gallery. Each is a view over a film or over the home
 * page, or a list that lives on one device, and none of them is a result a
 * reader searches for. The tag keeps them out of the index while the pages
 * they open from stay in it.
 */
export function NoIndex() {
  return (
    <Head>
      <meta name="robots" content="noindex" />
    </Head>
  )
}
