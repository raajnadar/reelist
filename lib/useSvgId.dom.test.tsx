/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useSvgId } from './useSvgId'

// React DOM, not React Native, for the reason lib/useServerPainted.dom.test.tsx
// records: the subject is the static web export.
/* eslint-disable @typescript-eslint/no-require-imports */
const { renderToString } = require('react-dom/server.node') as {
  renderToString: (node: ReactNode) => string
}
const { hydrateRoot } = require('react-dom/client') as {
  hydrateRoot: (container: Element, node: ReactNode) => unknown
}
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * The shape of the export: the server renders the app inside the document,
 * and the client hydrates `#root` only. Two children above `#root` are a fork
 * in the `useId` path, as `<head>` and `<body>` are.
 */
function exportPage(app: ReactNode): Element {
  const container = document.createElement('div')
  container.innerHTML = renderToString(
    <div>
      <p />
      <div id="root">{app}</div>
    </div>,
  )
  return container.querySelector('#root')!
}

function Mark({ name }: { name: string }) {
  const id = useSvgId(name)
  return (
    <svg>
      <mask id={id} />
      <circle mask={`url(#${id})`} />
    </svg>
  )
}

const page = (
  <>
    <Mark name="reel holes" />
    <Mark name="reel holes" />
  </>
)

it('writes the key alone into the export', () => {
  const root = exportPage(page)

  expect([...root.querySelectorAll('mask')].map((m) => m.id)).toEqual([
    'reel-holes',
    'reel-holes',
  ])
})

it('hydrates the export with no mismatch, then gives each mark its own id', async () => {
  const root = exportPage(page)
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})

  await act(async () => {
    hydrateRoot(root, page)
  })
  const errors = error.mock.calls.length
  error.mockRestore()

  // A plain `useId` fails here: React logs that the attributes differ.
  expect(errors).toBe(0)
  const masks = [...root.querySelectorAll('mask')].map((m) => m.id)
  expect(new Set(masks).size).toBe(2)
  expect([...root.querySelectorAll('circle')].map((c) => c.getAttribute('mask'))).toEqual(
    masks.map((id) => `url(#${id})`),
  )
})

it('gives each instance its own id from the first render with no hydration', () => {
  const { result } = renderHook(() => [useSvgId('reel'), useSvgId('reel')])

  const [first, second] = result.current
  expect(first).toMatch(/^reel-/)
  expect(second).toMatch(/^reel-/)
  expect(first).not.toBe(second)
})
