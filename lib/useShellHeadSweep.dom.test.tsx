/**
 * @jest-environment jsdom
 */
import { act, type ReactNode } from 'react'
import { useShellHeadSweep } from './useShellHeadSweep'

// React DOM, not React Native: the subject is the head of a static web page.
// The project has no type package for react-dom, so the call is typed here.
/* eslint-disable @typescript-eslint/no-require-imports */
const { createRoot } = require('react-dom/client') as {
  createRoot: (container: Element) => {
    render: (node: ReactNode) => void
    unmount: () => void
  }
}
/* eslint-enable @typescript-eslint/no-require-imports */

function Probe() {
  useShellHeadSweep()
  return null
}

const SERVER_TAGS = [
  '<meta charset="utf-8">',
  '<title>Trending and popular films · Reelist</title>',
  '<meta name="description" content="The home page.">',
  '<link rel="canonical" href="https://example.com/">',
  '<meta property="og:title" content="Reelist">',
  '<meta property="og:url" content="https://example.com/">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<link rel="manifest" href="/manifest.webmanifest">',
]

const PAGE_TAGS = [
  '<title data-rh="true">Trailer · Reelist</title>',
  '<meta name="robots" content="noindex" data-rh="true">',
  '<link rel="canonical" href="https://example.com/privacy" data-rh="true">',
]

it('takes the canonical link, the description, and the share card of the server out', async () => {
  document.head.innerHTML = [...SERVER_TAGS, ...PAGE_TAGS].join('')
  const root = createRoot(document.body.appendChild(document.createElement('div')))

  await act(async () => {
    root.render(<Probe />)
  })

  // The shell tags that name the page stay: the charset, the title (which
  // PageHead replaces itself), and the manifest. Every tag of the page stays.
  expect(Array.from(document.head.children).map((node) => node.outerHTML)).toEqual([
    SERVER_TAGS[0],
    SERVER_TAGS[1],
    SERVER_TAGS[7],
    ...PAGE_TAGS,
  ])
  root.unmount()
})
