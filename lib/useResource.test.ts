import { act, renderHook, waitFor } from '@testing-library/react-native'
import { MissingProxyUrlError } from './config'
import { CACHE_TTL_MS, clearCache } from './resourceCache'
import { useResource } from './useResource'

beforeEach(() => {
  clearCache()
})

// This version of `renderHook` types the callback as `(props: unknown) => any`
// and does not infer the shape from `initialProps`, so each caller states it.
type Props = { key: string | null }

it('reports a loading state before the answer arrives', async () => {
  const { result } = renderHook(() =>
    useResource('a', () => Promise.resolve('film'), 'failed'),
  )

  expect(result.current).toMatchObject({ loading: true, data: null, failure: null })

  // The request still settles after the assertion. Letting it land inside `act`
  // keeps its state update out of the next test.
  await act(async () => {})
})

it('holds the answer once it arrives', async () => {
  const { result } = renderHook(() =>
    useResource('a', () => Promise.resolve('film'), 'failed'),
  )

  await waitFor(() => expect(result.current.data).toBe('film'))
  expect(result.current).toMatchObject({ loading: false, failure: null })
})

it('sends no request while the key is null, and reports no failure', async () => {
  const fetcher = jest.fn(() => Promise.resolve('film'))

  const { result } = renderHook(() => useResource(null, fetcher, 'failed'))

  await act(async () => {})
  expect(fetcher).not.toHaveBeenCalled()
  // Idle, not loading. The search screen draws its prompt from this state.
  expect(result.current).toMatchObject({ loading: false, data: null, failure: null })
})

it('classifies a rejection through lib/errors', async () => {
  const error = new MissingProxyUrlError()
  const { result } = renderHook(() =>
    useResource('a', () => Promise.reject(error), 'failed'),
  )

  // `setup`, not `transient`: the screen offers a retry button for one and not
  // for the other, so the kind is the part worth asserting. The message is the
  // one the error carries, because it is written for the person who sees it.
  await waitFor(() =>
    expect(result.current.failure).toEqual({ kind: 'setup', message: error.message }),
  )
  expect(result.current.data).toBeNull()
})

it('uses the fallback message for a throw that is not an Error', async () => {
  const { result } = renderHook(() =>
    useResource('a', () => Promise.reject('nope'), 'Could not load movies'),
  )

  await waitFor(() =>
    expect(result.current.failure).toEqual({
      kind: 'transient',
      message: 'Could not load movies',
    }),
  )
})

it('ignores an answer that arrives after the key changed', async () => {
  let resolveFirst: (v: string) => void = () => {}
  const fetcher = jest.fn((key: string | null) =>
    key === 'a'
      ? new Promise<string>((resolve) => {
          resolveFirst = resolve
        })
      : Promise.resolve('second'),
  )

  const { result, rerender } = renderHook(
    ({ key }: Props) => useResource(key, () => fetcher(key), 'failed'),
    { initialProps: { key: 'a' } },
  )

  rerender({ key: 'b' })
  await waitFor(() => expect(result.current.data).toBe('second'))

  // The slow first request lands now. Its answer belongs to a key nothing is
  // asking for any more, so it must not replace the one on screen.
  await act(async () => {
    resolveFirst('first')
  })
  expect(result.current.data).toBe('second')
})

it('answers a repeated key from the store, without a second request', async () => {
  const fetcher = jest.fn(() => Promise.resolve('film'))

  const first = renderHook(() => useResource('a', fetcher, 'failed'))
  await waitFor(() => expect(first.result.current.data).toBe('film'))
  first.unmount()

  const second = renderHook(() => useResource('a', fetcher, 'failed'))

  // Drawn on the first frame, with no loading state at all. This is what stops
  // the home rows from reloading every time the reader comes back to them.
  expect(second.result.current).toMatchObject({ data: 'film', loading: false })
  await act(async () => {})
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('draws the stale copy while it requests a new one', async () => {
  jest.useFakeTimers()
  const fetcher = jest.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new')

  const first = renderHook(() => useResource('a', fetcher, 'failed'))
  await act(async () => {})
  expect(first.result.current.data).toBe('old')
  first.unmount()

  jest.advanceTimersByTime(CACHE_TTL_MS)
  const second = renderHook(() => useResource('a', fetcher, 'failed'))

  // The old answer is on screen immediately, and it is not a loading state.
  expect(second.result.current).toMatchObject({ data: 'old', loading: false })
  await act(async () => {})
  expect(second.result.current.data).toBe('new')
  expect(fetcher).toHaveBeenCalledTimes(2)
  jest.useRealTimers()
})

it('keeps the stale copy when the request that would replace it fails', async () => {
  jest.useFakeTimers()
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce('old')
    .mockRejectedValueOnce(new Error('offline'))

  const first = renderHook(() => useResource('a', fetcher, 'failed'))
  await act(async () => {})
  first.unmount()

  jest.advanceTimersByTime(CACHE_TTL_MS)
  const second = renderHook(() => useResource('a', fetcher, 'failed'))
  await act(async () => {})

  // Films the reader can see outrank the report of a refresh they never asked
  // for. Replacing them with an error would take away working content.
  expect(second.result.current).toMatchObject({ data: 'old', failure: null })
  jest.useRealTimers()
})

it('asks again on reload, ignoring the stored answer', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new')

  const { result } = renderHook(() => useResource('a', fetcher, 'failed'))
  await waitFor(() => expect(result.current.data).toBe('old'))

  act(() => {
    result.current.reload()
  })

  // Back to the placeholders: a retry that left the old answer on screen would
  // look like a button that does nothing.
  expect(result.current).toMatchObject({ loading: true, data: null })
  await waitFor(() => expect(result.current.data).toBe('new'))
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('clears a failure on a reload that succeeds', async () => {
  const fetcher = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce('film')

  const { result } = renderHook(() => useResource('a', fetcher, 'failed'))
  await waitFor(() => expect(result.current.failure).not.toBeNull())

  act(() => {
    result.current.reload()
  })

  await waitFor(() => expect(result.current.data).toBe('film'))
  expect(result.current.failure).toBeNull()
})

it('calls the fetcher the render supplied, not the one from the previous key', async () => {
  const seen: (string | null)[] = []
  const { rerender, result } = renderHook(
    ({ key }: Props) =>
      useResource(
        key,
        () => {
          seen.push(key)
          return Promise.resolve(key)
        },
        'failed',
      ),
    { initialProps: { key: 'a' } },
  )

  await waitFor(() => expect(result.current.data).toBe('a'))
  rerender({ key: 'b' })
  await waitFor(() => expect(result.current.data).toBe('b'))

  expect(seen).toEqual(['a', 'b'])
})
