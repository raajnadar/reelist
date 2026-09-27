import type { MovieDetail } from '../lib/types'

/**
 * The document head for one film. Native has no document, so this renders
 * nothing. The web version is in PageHead.web.tsx.
 */
export function PageHead(_props: { movie: MovieDetail }) {
  return null
}
