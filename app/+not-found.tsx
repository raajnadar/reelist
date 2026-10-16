import { useTheme } from '@rootnative/core'
import { PageHead } from '@rootnative/seo/expo-router'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { StateMessage } from '../components/StateMessage'

/**
 * The screen for a path that names no route: a mistyped link, or a link to a
 * screen the app no longer has.
 *
 * Without this file Expo Router draws its own screen, and the export writes it
 * outside the root layout: no title, no `<h1>`, and no `<main>`. The page has
 * nothing to index, so it gets `noindex`.
 */
export default function NotFoundScreen() {
  const theme = useTheme()
  const router = useRouter()

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PageHead title="Page not found" noindex />
      <StateMessage
        testID="not-found"
        icon="link-off"
        tone="error"
        title="Page not found"
        titleLevel={1}
        body="That link does not point at a page."
        actionLabel="Go home"
        actionIcon="home-outline"
        onAction={() => router.replace('/')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
})
