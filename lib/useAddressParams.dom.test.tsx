/**
 * @jest-environment jsdom
 */
import { act } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { useAddressKey, useAddressParams } from './useAddressParams'
import { useUrlState } from './useUrlState'

// React DOM, not React Native, for the reason lib/useServerPainted.dom.test.tsx
// records: the subject is the static web export.
/* eslint-disable @typescript-eslint/no-require-imports */
const { renderToString } = require('react-dom/server.node') as {
  renderToString: (node: ReactNode) => string
}
const { hydrateRoot } = require('react-dom/client') as {
  hydrateRoot: (
    container: Element,
    node: ReactNode,
    options: { onRecoverableError: (error: unknown) => void },
  ) => { unmount: () => void }
}
/* eslint-enable @typescript-eslint/no-require-imports */

let mockRouteParams: Record<string, string> = {}
const mockSetParams = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => ({ setParams: mockSetParams }),
}))

function Search({ read }: { read: () => { q?: string } }) {
  const [query] = useState(read().q ?? '')
  useUrlState({ q: query || undefined })
  return <p>{query ? `Results for ${query}` : 'Type a title'}</p>
}

function SearchRoute({ read }: { read: () => { q?: string } }) {
  const key = useAddressKey()
  return <Search key={key} read={read} />
}

/**
 * The export writes the page with no query string. Then the browser opens
 * the address and hydrates that HTML.
 */
async function openExport(address: string, read: () => { q?: string }) {
  window.history.replaceState(null, '', '/search')
  mockRouteParams = {}
  const root = document.createElement('div')
  root.innerHTML = renderToString(<SearchRoute read={read} />)
  const serverNode = root.firstChild

  window.history.replaceState(null, '', address)
  mockRouteParams = Object.fromEntries(new URLSearchParams(window.location.search))
  const mismatches: unknown[] = []
  await act(async () => {
    hydrated.push(
      hydrateRoot(root, <SearchRoute read={read} />, {
        onRecoverableError: (error) => mismatches.push(error),
      }),
    )
  })

  return { root, serverNode, mismatches }
}

const hydrated: { unmount: () => void }[] = []

beforeEach(() => mockSetParams.mockClear())

afterEach(async () => {
  await act(async () => {
    for (const root of hydrated.splice(0)) root.unmount()
  })
})

it('hydrates a link with a query and no mismatch, then reads the query', async () => {
  const { root, mismatches } = await openExport('/search?q=dune', () =>
    useAddressParams<{ q?: string }>(),
  )

  expect(mismatches).toEqual([])
  expect(root.textContent).toBe('Results for dune')
  // The hydration render wrote nothing, so the query stayed in the address.
  expect(mockSetParams).not.toHaveBeenCalled()
})

it('keeps the hydrated tree when the address has no query string', async () => {
  const { root, serverNode, mismatches } = await openExport('/search', () =>
    useAddressParams<{ q?: string }>(),
  )

  expect(mismatches).toEqual([])
  expect(root.firstChild).toBe(serverNode)
  expect(mockSetParams).not.toHaveBeenCalled()
})

it('fails hydration when the screen reads the query in the hydration render', async () => {
  const { mismatches } = await openExport('/search?q=dune', () =>
    useLocalSearchParams<{ q?: string }>(),
  )

  expect(mismatches).not.toEqual([])
})
