import { useEffect } from 'react'

/** The attribute on every tag that `PageHead` wrote for this page. */
const HELMET_ATTRIBUTE = 'data-rh'

/** The tags that describe a page to a crawler and to a share card. */
const SHELL_TAGS = [
  'link[rel="canonical"]',
  'meta[name="description"]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
].join(',')

/**
 * Takes the canonical link, the description, and the share card of the
 * server head out of the document, once the page has hydrated.
 *
 * For a `noindex` page the export did not write, which the host serves from
 * the home shell: a trailer, a gallery, or a search opened by its address.
 * `PageHead` takes out the server copy of each tag it writes, and a
 * `noindex` head writes the title and the robots tag only, so the home
 * canonical link and share card stayed beside the `noindex`. Only a tag
 * with no helmet attribute goes: that is the server's, and a tag `PageHead`
 * wrote for this page carries the attribute. Native has no document, and
 * the export server runs no effect.
 */
export function useShellHeadSweep(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return
    for (const node of Array.from(document.head.querySelectorAll(SHELL_TAGS))) {
      if (!node.hasAttribute(HELMET_ATTRIBUTE)) node.remove()
    }
  }, [])
}
