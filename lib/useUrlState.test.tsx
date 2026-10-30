import { renderHook } from '@testing-library/react-native'
import { useUrlState } from './useUrlState'

const mockSetParams = jest.fn()
let mockParams: Record<string, string | string[]> = {}

jest.mock('expo-router', () => ({
  useRouter: () => ({ setParams: mockSetParams }),
  useLocalSearchParams: () => mockParams,
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
})

it('writes the state the address does not have', () => {
  renderHook(() => useUrlState({ q: 'dune' }))

  expect(mockSetParams).toHaveBeenCalledWith({ q: 'dune' })
})

it('writes nothing when the address already carries the state', () => {
  mockParams = { q: 'dune', extra: 'kept' }

  renderHook(() => useUrlState({ q: 'dune' }))

  expect(mockSetParams).not.toHaveBeenCalled()
})

it('reads a repeated parameter by its first value', () => {
  mockParams = { q: ['dune', 'alien'] }

  renderHook(() => useUrlState({ q: 'dune' }))

  expect(mockSetParams).not.toHaveBeenCalled()
})

// `setParams` drops a parameter for `undefined`, so a cleared value must reach
// it as a change, not be left out.
it('sends undefined for a value the address must lose', () => {
  mockParams = { q: 'dune' }
  const { rerender } = renderHook(({ q }: { q?: string }) => useUrlState({ q }), {
    initialProps: { q: 'dune' },
  })
  expect(mockSetParams).not.toHaveBeenCalled()

  rerender({ q: undefined })

  expect(mockSetParams).toHaveBeenCalledWith({ q: undefined })
})

it('writes once per change of state, not per render', () => {
  const { rerender } = renderHook(({ q }: { q: string }) => useUrlState({ q }), {
    initialProps: { q: 'dune' },
  })
  rerender({ q: 'dune' })
  rerender({ q: 'dune' })

  expect(mockSetParams).toHaveBeenCalledTimes(1)
})
