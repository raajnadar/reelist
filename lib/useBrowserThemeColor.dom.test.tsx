/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react-native'
import { useBrowserThemeColor } from './useBrowserThemeColor'

const SHELL_TAGS = [
  '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff8f7">',
  '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a1112">',
]

const themeColors = () =>
  Array.from(document.head.querySelectorAll('meta[name="theme-color"]')).map((meta) =>
    meta.getAttribute('content'),
  )

it('gives both shell tags the colour of the scheme that renders', () => {
  document.head.innerHTML = SHELL_TAGS.join('')

  // A dark mode picked in the app, on a light system.
  const { rerender } = renderHook(
    ({ color }: { color: string }) => useBrowserThemeColor(color),
    {
      initialProps: { color: '#1a1112' },
    },
  )
  expect(themeColors()).toEqual(['#1a1112', '#1a1112'])

  rerender({ color: '#fff8f7' })
  expect(themeColors()).toEqual(['#fff8f7', '#fff8f7'])
})
