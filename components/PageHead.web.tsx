import Head from 'expo-router/head'
import { backdropUrl, posterUrl } from '../lib/images'
import { movieUrl, shareTitle } from '../lib/share'
import type { MovieDetail } from '../lib/types'

/**
 * The longest description a search result shows before it cuts the text.
 */
const DESCRIPTION_LIMIT = 160

const describe = (movie: MovieDetail) => {
  const text = movie.overview || movie.tagline || `${movie.title} on Reelist.`
  if (text.length <= DESCRIPTION_LIMIT) return text
  return `${text.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`
}

/**
 * The document head for one film on the web: the tab title, the description,
 * the canonical link, and the Open Graph and Twitter cards a share unfurls.
 *
 * The web build is a client-rendered page, so these tags are written by the
 * browser after the film loads. A crawler that runs JavaScript reads them. A
 * crawler that reads the static HTML only sees the tags in dist/index.html.
 * A prerender for each film is the fix for that, and it is out of scope here.
 */
export function PageHead({ movie }: { movie: MovieDetail }) {
  const title = `${shareTitle(movie)} · Reelist`
  const description = describe(movie)
  const url = movieUrl(movie.id)
  const image = backdropUrl(movie.backdrop_path) ?? posterUrl(movie.poster_path, 'w500')

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="video.movie" />
      <meta property="og:site_name" content="Reelist" />
      <meta property="og:title" content={shareTitle(movie)} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image ? <meta property="og:image" content={image} /> : null}

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={shareTitle(movie)} />
      <meta name="twitter:description" content={description} />
      {image ? <meta name="twitter:image" content={image} /> : null}
    </Head>
  )
}
