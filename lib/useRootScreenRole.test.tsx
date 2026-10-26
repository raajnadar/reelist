import { router, Stack } from 'expo-router'
import { act, renderRouter, screen } from 'expo-router/testing-library'
import { Text, View } from 'react-native'
import { useRootScreenRole } from './useRootScreenRole'

/** The root stack of app/_layout.tsx: the group, and a sheet above it. */
function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" />
      <Stack.Screen name="search" options={{ presentation: 'transparentModal' }} />
    </Stack>
  )
}

function RootScreen() {
  return <View testID="root-screen" role={useRootScreenRole()} />
}

async function renderAt(initialUrl: string) {
  await renderRouter(
    {
      _layout: RootLayout,
      '(main)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      '(main)/index': () => <Text>Home page</Text>,
      search: RootScreen,
      '+not-found': RootScreen,
    },
    { initialUrl },
  )
}

const role = () => screen.getByTestId('root-screen').props.role

describe('useRootScreenRole', () => {
  it('is the main landmark on a deep link, with no page below', async () => {
    await renderAt('/search')
    expect(role()).toBe('main')
  })

  it('is the main landmark for an unknown address', async () => {
    await renderAt('/no-such-page')
    expect(role()).toBe('main')
  })

  it('takes no landmark over a page, which holds the main one', async () => {
    await renderAt('/')
    act(() => router.push('/search'))
    expect(role()).toBeUndefined()
  })

  // `router.canGoBack()` in the render asked `navigation.isFocused()`, which
  // React Navigation warns about in development.
  it('does not read the focus during the render', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await renderAt('/')
    act(() => router.push('/search'))
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('isFocused()'))
    warn.mockRestore()
  })
})
