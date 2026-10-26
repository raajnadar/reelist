import { act, renderHook } from '@testing-library/react-native'
import type { NetworkState } from 'expo-network'
import { isOnline, resetNetwork, subscribeOnline, useOnline } from './network'

type Listener = (state: NetworkState) => void
const mockNative = { listener: null as Listener | null, state: {} as NetworkState }
const mockRemove = jest.fn()

jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn((listener: Listener) => {
    mockNative.listener = listener
    return { remove: mockRemove }
  }),
  getNetworkStateAsync: jest.fn(() => Promise.resolve(mockNative.state)),
}))

beforeEach(() => {
  resetNetwork()
  mockNative.listener = null
  mockNative.state = {}
  mockRemove.mockClear()
})

const report = (state: NetworkState) => {
  act(() => mockNative.listener?.(state))
}

describe('isOnline', () => {
  it('is true until the device says no', () => {
    expect(isOnline({})).toBe(true)
    expect(isOnline({ isConnected: true, isInternetReachable: undefined })).toBe(true)
  })

  it('is false on a lost connection or an unreachable internet', () => {
    expect(isOnline({ isConnected: false })).toBe(false)
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false)
  })
})

it('starts online, then follows the device', async () => {
  const { result } = renderHook(() => useOnline())

  expect(result.current).toBe(true)
  await act(async () => {})

  report({ isConnected: false })
  expect(result.current).toBe(false)

  report({ isConnected: true, isInternetReachable: true })
  expect(result.current).toBe(true)
})

it('reads the state once at the start, because the listener reports changes only', async () => {
  mockNative.state = { isConnected: false }
  const { result } = renderHook(() => useOnline())

  await act(async () => {})
  expect(result.current).toBe(false)
})

it('calls a subscriber with each change, and not with a repeat', async () => {
  const seen: boolean[] = []
  const unsubscribe = subscribeOnline((online) => seen.push(online))
  await act(async () => {})

  report({ isConnected: false })
  report({ isConnected: false })
  report({ isConnected: true })
  expect(seen).toEqual([false, true])

  unsubscribe()
})

it('ends the native subscription with the last subscriber', async () => {
  const first = renderHook(() => useOnline())
  const second = renderHook(() => useOnline())
  await act(async () => {})

  first.unmount()
  expect(mockRemove).not.toHaveBeenCalled()
  second.unmount()
  expect(mockRemove).toHaveBeenCalledTimes(1)
})
