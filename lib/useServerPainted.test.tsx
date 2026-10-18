/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useServerPainted } from './useServerPainted'

// React DOM, not React Native: the subject is the static web export, which
// renders on a server and hydrates in a browser. The project has no type
// package for react-dom, so the two calls are typed here. The server build
// is the Node one, as on the export server: the browser build needs a
// MessageChannel, which jsdom does not supply.
/* eslint-disable @typescript-eslint/no-require-imports */
const { renderToString } = require('react-dom/server.node') as {
  renderToString: (node: ReactNode) => string
}
const { hydrateRoot } = require('react-dom/client') as {
  hydrateRoot: (container: Element, node: ReactNode) => unknown
}
/* eslint-enable @typescript-eslint/no-require-imports */

function Probe({ seen }: { seen: boolean[] }) {
  const painted = useServerPainted()
  seen.push(painted)
  return <span>{String(painted)}</span>
}

it('is true on the export server', () => {
  expect(renderToString(<Probe seen={[]} />)).toBe('<span>true</span>')
})

it('stays true after hydration, so a mounted entrance does not change', async () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(<Probe seen={[]} />)
  const seen: boolean[] = []

  await act(async () => {
    hydrateRoot(container, <Probe seen={seen} />)
  })

  // The second render is the one React schedules when the client snapshot
  // differs from the server one. Without the fixed state it reads false.
  expect(seen.length).toBeGreaterThan(1)
  expect(seen.every(Boolean)).toBe(true)
  expect(container.textContent).toBe('true')
})

it('is false for a mount with no hydration', () => {
  const { result } = renderHook(() => useServerPainted())

  expect(result.current).toBe(false)
})
