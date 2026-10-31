import { useEffect } from 'react'
import { Platform } from 'react-native'

/**
 * Paints the browser chrome in `color` on the web. Native has no browser
 * chrome.
 *
 * app/+html.tsx writes one `theme-color` tag for each system scheme, and the
 * browser reads the tag that matches the system. A reader who picks the other
 * mode in the app would get a bar that does not match the page. So after
 * hydration both tags take the colour of the scheme that renders.
 *
 * `@rootnative/seo` has no hook for this yet (DX feedback R33). Remove this
 * file when it ships.
 */
export function useBrowserThemeColor(color: string): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return
    for (const meta of Array.from(
      document.querySelectorAll('meta[name="theme-color"]'),
    )) {
      meta.setAttribute('content', color)
    }
  }, [color])
}
