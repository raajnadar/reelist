import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { ContentWidthContext, useContentWidth } from './useContentWidth'

const mockWindow = { width: 1280, height: 800 }

jest.mock('@rootnative/core', () => ({
  ...jest.requireActual('@rootnative/core'),
  useWindowDimensions: () => mockWindow,
}))

describe('useContentWidth', () => {
  it('is the window width when nothing has measured the content', () => {
    const { result } = renderHook(() => useContentWidth())
    expect(result.current).toBe(1280)
  })

  it('is the measured width inside the navigation', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ContentWidthContext.Provider value={1200}>{children}</ContentWidthContext.Provider>
    )
    const { result } = renderHook(() => useContentWidth(), { wrapper })
    expect(result.current).toBe(1200)
  })

  it('falls back to the window before the first layout', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ContentWidthContext.Provider value={null}>{children}</ContentWidthContext.Provider>
    )
    const { result } = renderHook(() => useContentWidth(), { wrapper })
    expect(result.current).toBe(1280)
  })
})
