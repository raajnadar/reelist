/**
 * The data the web export wrote into this page, or null.
 *
 * Native has no export and no HTML, so it always gets null and loads from the
 * proxy. The web version is in usePrerendered.web.ts.
 */
export function usePrerendered<T>(key: string): T | null {
  return null
}
