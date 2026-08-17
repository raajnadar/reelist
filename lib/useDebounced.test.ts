import { act, renderHook } from '@testing-library/react-native'
import { SEARCH_DEBOUNCE_MS, useDebounced } from './useDebounced'

// Fake timers, because the whole subject is a delay. Real timers would make
// each assertion wait, and a test that sleeps is a test that flakes on a slow
// machine.
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

it('returns the first value immediately, with no wait', () => {
  const { result } = renderHook(() => useDebounced('dune'))

  // The initial value seeds state directly. Waiting for it would leave the
  // search screen blank for one delay before it could show its prompt.
  expect(result.current).toBe('dune')
})

// This version of `renderHook` types the callback as `(props: unknown) => any`
// and does not infer the shape from `initialProps`, so each caller states it.
type Props = { value: string }

it('holds the old value until the delay passes', () => {
  const { result, rerender } = renderHook(({ value }: Props) => useDebounced(value), {
    initialProps: { value: 'a' },
  })

  rerender({ value: 'ab' })
  expect(result.current).toBe('a')

  // One millisecond short: still the old value. This is the assertion that
  // proves the delay is real rather than an accident of scheduling.
  act(() => {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
  })
  expect(result.current).toBe('a')

  act(() => {
    jest.advanceTimersByTime(1)
  })
  expect(result.current).toBe('ab')
})

it('emits only the last value of a fast burst', () => {
  const { result, rerender } = renderHook(({ value }: Props) => useDebounced(value), {
    initialProps: { value: '' },
  })

  // Typing "dune" one letter at a time, each keystroke inside the window. This
  // is the case the search screen exists to avoid: four requests for one word.
  for (const value of ['d', 'du', 'dun', 'dune']) {
    rerender({ value })
    act(() => {
      jest.advanceTimersByTime(50)
    })
    // Nothing has settled yet — every intermediate value is still withheld.
    expect(result.current).toBe('')
  }

  act(() => {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
  })
  expect(result.current).toBe('dune')
})

it('honours a custom delay', () => {
  const { result, rerender } = renderHook(
    ({ value }: Props) => useDebounced(value, 1000),
    {
      initialProps: { value: 'a' },
    },
  )

  rerender({ value: 'b' })

  act(() => {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
  })
  expect(result.current).toBe('a')

  act(() => {
    jest.advanceTimersByTime(1000 - SEARCH_DEBOUNCE_MS)
  })
  expect(result.current).toBe('b')
})

it('cancels the pending timer when it unmounts', () => {
  const { rerender, unmount } = renderHook(({ value }: Props) => useDebounced(value), {
    initialProps: { value: 'a' },
  })

  rerender({ value: 'b' })
  unmount()

  // A timer that survived the unmount would call setState on a dead component.
  // React 19 no longer warns for that, so the count is the only evidence.
  expect(jest.getTimerCount()).toBe(0)
})
