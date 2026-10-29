import { useId } from 'react'
import { useHydrating } from './useHydrating'

/**
 * An id for an SVG definition, such as a mask or a gradient, that a
 * `url(#...)` reference reads.
 *
 * `key` names what the definition draws. Two definitions with the same key
 * must draw the same thing.
 *
 * After hydration, each instance gets its own id. On the web every `<svg>` is
 * in one document, and `url(#...)` reads the first element with that id. When
 * a navigator hides the screen that holds that first element, the reference
 * draws nothing: the mark comes out as a plain filled circle, and a scrim
 * loses its gradient.
 *
 * In the static export and in the hydration render, the id is the key alone.
 * A `useId` value is different on the two sides: the export renders the app
 * inside the `+html.tsx` document, so its `useId` path holds the forks of
 * `<html>` and `<body>`, and the client hydrates `#root` only. Hydration keeps
 * the server attribute (lib/useHydrating.ts), so the client then knows an id
 * that is not in the page. A static page has no hidden screen, so a shared id
 * draws correctly there.
 */
export function useSvgId(key: string): string {
  const unique = useId().replace(/[^a-zA-Z0-9]/g, '')
  const base = key.replace(/[^a-zA-Z0-9-]/g, '-')

  return useHydrating() ? base : `${base}-${unique}`
}
