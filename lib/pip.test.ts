import { act, renderHook } from '@testing-library/react-native'
import { enterPip, pipSupported, setAutoEnterPip, useInPip } from './pip'

// The native module as a store build with `expo-pip` has it. The module is
// read once, at import, so the build without it is lib/pip.absent.test.ts.
//
// The stand-in is built inside the factory. `jest.mock` is hoisted above the
// imports, and lib/pip.ts reads the module as it is imported, so a value
// declared in this file would still be unset at that moment.
jest.mock('expo', () => {
  const native = {
    isInPipMode: jest.fn(() => false),
    setPictureInPictureParams: jest.fn(),
    enterPipMode: jest.fn(),
    addListener: jest.fn(),
    listener: null,
    remove: jest.fn(),
  }
  native.addListener.mockImplementation((_name, fn) => {
    native.listener = fn
    return { remove: native.remove }
  })
  return { requireOptionalNativeModule: () => native, __native: native }
})

const mockNative = jest.requireMock('expo').__native as {
  isInPipMode: jest.Mock
  setPictureInPictureParams: jest.Mock
  enterPipMode: jest.Mock
  addListener: jest.Mock
  listener: ((event: { isInPipMode: boolean }) => void) | null
  remove: jest.Mock
}

beforeEach(() => {
  mockNative.isInPipMode.mockClear()
  mockNative.setPictureInPictureParams.mockClear()
  mockNative.enterPipMode.mockClear()
  mockNative.remove.mockClear()
  mockNative.listener = null
})

it('reports support', () => {
  expect(pipSupported).toBe(true)
})

// The flag is on the activity, so the screen has to turn it off as well as
// on. Both go through, with the 16:9 shape the video fills.
it('sets and clears the auto-enter flag with the video shape', () => {
  setAutoEnterPip(true, 'Dune')
  setAutoEnterPip(false)

  expect(mockNative.setPictureInPictureParams).toHaveBeenNthCalledWith(1, {
    width: 16,
    height: 9,
    autoEnterEnabled: true,
    seamlessResizeEnabled: true,
    title: 'Dune',
  })
  expect(mockNative.setPictureInPictureParams).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ autoEnterEnabled: false, title: null }),
  )
})

it('enters the small window on request', () => {
  enterPip('Dune')

  expect(mockNative.enterPipMode).toHaveBeenCalledWith({
    width: 16,
    height: 9,
    title: 'Dune',
  })
})

it('follows the mode changes the activity reports, and stops on unmount', () => {
  const { result, unmount } = renderHook(() => useInPip())

  expect(result.current).toBe(false)
  act(() => mockNative.listener?.({ isInPipMode: true }))
  expect(result.current).toBe(true)
  act(() => mockNative.listener?.({ isInPipMode: false }))
  expect(result.current).toBe(false)

  unmount()
  expect(mockNative.remove).toHaveBeenCalled()
})

// The activity can already be small when the hook mounts, after a re-render
// in the small window.
it('starts from the mode the activity is in', () => {
  mockNative.isInPipMode.mockReturnValueOnce(true)

  const { result } = renderHook(() => useInPip())

  expect(result.current).toBe(true)
})
