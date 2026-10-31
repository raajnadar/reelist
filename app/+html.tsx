import {
  SCHEME_ATTRIBUTE,
  schemeGuardCss,
  schemeGuardScript,
} from '@rootnative/core/static-export'
import {
  entranceGuardCss,
  entranceGuardNoscriptCss,
} from '@rootnative/inertia/static-export'
import { shellTags } from '@rootnative/seo/expo-router'
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html'
import type { PropsWithChildren } from 'react'
import { STORAGE_KEY as APPEARANCE_STORAGE_KEY } from '../lib/appearance'
import { darkTheme, lightTheme } from '../theme'

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
 * default shell with two preconnect links, the theme colours, the icons, the
 * manifest, and the inertia entrance guard added, and the obsolete
 * `X-UA-Compatible` tag removed.
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
 *
 * The SVG favicon must come before the `favicon.ico` link that Expo writes from
 * app.json after the page head. Chrome takes the first of two icon links with
 * no `sizes`, and Firefox always takes an SVG. Safari falls back to the ICO.
 */

/**
 * The scheme guard of core alpha.28, with the stored choice of this app.
 *
 * The export holds the light theme as inline styles, so a reader with a dark
 * scheme saw a light page until the bundle hydrated. The core script reads the
 * OS scheme and writes it to `<html>`; the CSS then hides the page for a dark
 * reader until ThemeProvider marks the theme ready.
 *
 * The core script reads a bare 'dark' or 'light' from localStorage, but this
 * app stores `{ "mode": "dark" }` under its own key (lib/appearance.ts). So
 * the core script runs with no key, and a second script applies the stored
 * choice over the OS scheme, as the provider does after hydration.
 */
const schemeGuard = `${schemeGuardScript({ storageKey: null })};
(function () {
  try {
    var mode = JSON.parse(window.localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)})).mode
    if (mode === 'dark' || mode === 'light') {
      document.documentElement.setAttribute(${JSON.stringify(SCHEME_ATTRIBUTE)}, mode)
    }
  } catch (e) {}
})()
`

export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } =
    useServerDocumentContext()
  const proxy = proxyOrigin()

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        {shellTags({
          basePath: process.env.EXPO_BASE_URL,
          themeColor: {
            light: lightTheme.colors.background,
            dark: darkTheme.colors.background,
          },
          favicon: '/favicon.svg',
          appleTouchIcon: '/apple-touch-icon.png',
          manifest: '/manifest.webmanifest',
          preconnect: [
            ...(proxy ? [{ href: proxy, crossOrigin: true }] : []),
            { href: 'https://image.tmdb.org' },
          ],
        })}
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: schemeGuard }} />
        <style
          dangerouslySetInnerHTML={{
            __html: schemeGuardCss({ background: darkTheme.colors.background }),
          }}
        />
        {/* A server-painted element shows at rest (lib/useServerPainted.ts).
            This reveals any entrance that still starts hidden when the bundle
            never runs. */}
        <style dangerouslySetInnerHTML={{ __html: entranceGuardCss() }} />
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: entranceGuardNoscriptCss }} />
        </noscript>
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  )
}
