import { useLoaderData } from 'expo-router'

/** Set by the inline script the export writes into the head of each page. */
type LoaderGlobal = { __EXPO_ROUTER_LOADER_DATA__?: Record<string, unknown> }

/**
 * The export renders each page in Node, with the result of the route `loader`
 * in a context. `useLoaderData` reads it from there and sends no request.
 */
function useExportData<T>(): T | null {
  return (useLoaderData() as T | undefined) ?? null
}

/**
 * In the browser, only the data the page HTML carries.
 *
 * `useLoaderData` fetches `/_expo/loaders/...` for a page whose HTML does not
 * carry its data, which is every page after the first. That path has no base
 * URL, so under /reelist/ it gets a 404 and the screen throws. A page with no
 * data here loads from the proxy, the same as a film the export did not write.
 */
function useHtmlData<T>(key: string): T | null {
  const data = (globalThis as LoaderGlobal).__EXPO_ROUTER_LOADER_DATA__
  return (data?.[key] as T | undefined) ?? null
}

/**
 * The data the web export wrote into this page, or null.
 *
 * `key` is the route file path with its parameters filled in: `/index` for
 * app/index.tsx and `/movie/550` for app/movie/[id].tsx. The export stores the
 * loader result of a page under that key. See `getContextKey` in
 * expo-router/build/matchers.js.
 *
 * The first render in the browser reads the same data the export rendered
 * with, so the page hydrates with no mismatch.
 */
export const usePrerendered: <T>(key: string) => T | null =
  typeof window === 'undefined' ? useExportData : useHtmlData
