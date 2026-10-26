/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useHydrating } from './useHydrating'

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

function Probe({ seen }: { seen: boolean[] }) {
  const hydrating = useHydrating()
  seen.push(hydrating)
  return <span>{String(hydrating)}</span>
}

/**
 * The shape of item 37: the server wrote the home page with its item lit,
 * and the client renders another page with nothing lit. One element takes
 * the key, one does not.
 */
function Bar({ lit }: { lit: boolean }) {
  const hydrating = useHydrating()
  return (
    <>
      <i id="plain" aria-selected={lit} />
      <i id="keyed" key={hydrating ? 'hydrating' : 'client'} aria-selected={lit} />
    </>
  )
}

it('is true on the export server', () => {
  expect(renderToString(<Probe seen={[]} />)).toBe('<span>true</span>')
})

it('is true in the hydration render, then false', async () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(<Probe seen={[]} />)
  const seen: boolean[] = []

  await act(async () => {
    hydrateRoot(container, <Probe seen={seen} />)
  })

  expect(seen[0]).toBe(true)
  expect(seen[seen.length - 1]).toBe(false)
  expect(container.textContent).toBe('false')
})

it('is false for a mount with no hydration', () => {
  const { result } = renderHook(() => useHydrating())

  expect(result.current).toBe(false)
})

it('lets a key replace an attribute that hydration keeps from the server', async () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(<Bar lit />)
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})

  await act(async () => {
    hydrateRoot(container, <Bar lit={false} />)
  })
  error.mockRestore()

  // Hydration leaves the server's attribute on the plain element: that is
  // the defect. The keyed one mounted again after hydration, with the
  // client's value.
  expect(container.querySelector('#plain')?.getAttribute('aria-selected')).toBe('true')
  expect(container.querySelector('#keyed')?.getAttribute('aria-selected')).toBe('false')
})
