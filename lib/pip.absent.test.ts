import { renderHook } from '@testing-library/react-native'
import { enterPip, pipSupported, setAutoEnterPip, useInPip } from './pip'

// Expo Go, a store build from before the module, iOS, and the web. Every call
// has to be a no-op, with no warning and no throw. This is what keeps an EAS
// Update safe for a build that has no module.
jest.mock('expo', () => ({ requireOptionalNativeModule: () => null }))

it('reports no support and does nothing', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

  expect(pipSupported).toBe(false)
  expect(() => {
    setAutoEnterPip(true, 'Dune')
    enterPip('Dune')
  }).not.toThrow()

  const { result, unmount } = renderHook(() => useInPip())
  expect(result.current).toBe(false)
  unmount()

  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})
