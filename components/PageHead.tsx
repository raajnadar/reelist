import type { PageMeta } from '../lib/head'

/**
 * The document head for one screen. Native has no document, so this renders
 * nothing. The web version is in PageHead.web.tsx.
 */
export function PageHead(_props: PageMeta) {
  return null
}
