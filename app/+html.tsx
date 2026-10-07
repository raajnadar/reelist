import { shellTags } from '@rootnative/seo/expo-router'
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html'
import type { PropsWithChildren } from 'react'

/**
 * The origin of the TMDB proxy, or null when the build has no proxy URL.
 *
 * This file runs in Node during the static export only, never in the browser,
 * so it reads the variable here and does not import lib/config.ts, which
 * throws when the URL is missing.
 */
function proxyOrigin(): string | null {
  try {
    return new URL(process.env.EXPO_PUBLIC_TMDB_PROXY_URL ?? '').origin
  } catch {
    return null
  }
}

/**
 * The HTML shell of every page the static export writes. It is Expo Router's
 * default shell with two preconnect links, the theme colour, the touch icon,
 * and the manifest added, and the obsolete `X-UA-Compatible` tag removed.
 *
 * The icon and the manifest live in public/, and their links carry the base
 * path the deploy sets, because GitHub Pages serves the site from a subpath.
 * See app.config.js. The manifest itself uses relative paths for the same
 * reason.
 *
 * The preconnect links open the connections to the proxy and to the TMDB image
 * CDN while the bundle downloads. Without them, the first API call and the
 * first poster each wait for a DNS lookup and a TLS handshake after the script
 * runs, and that delay is part of the Largest Contentful Paint.
 *
 * The proxy link needs `crossOrigin`: the API calls are CORS fetches, and the
 * browser does not use a preconnected socket for a CORS request unless the
 * link is in the same mode. The images load through a plain `<img>`, so their
 * link has no `crossOrigin`.
 */
/** The splash colour from app.json, which the browser paints around the page. */
const THEME_COLOR = '#4C0519'

export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } =
    useServerDocumentContext()
  const proxy = proxyOrigin()

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        {shellTags({
          basePath: process.env.EXPO_BASE_URL,
          themeColor: THEME_COLOR,
          appleTouchIcon: '/apple-touch-icon.png',
          manifest: '/manifest.webmanifest',
          preconnect: [
            ...(proxy ? [{ href: proxy, crossOrigin: true }] : []),
            { href: 'https://image.tmdb.org' },
          ],
        })}
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  )
}
