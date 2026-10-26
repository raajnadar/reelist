import { useTheme } from '@rootnative/core'
import { PageHead } from '@rootnative/seo/expo-router'
import { metadataFor } from '../lib/head'
import { notFoundMeta } from '../lib/site'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { StateMessage } from '../components/StateMessage'
import { useRootScreenRole } from '../lib/useRootScreenRole'

/**
 * Expo calls this for no route on a static export of SDK 58, so the head of
 * the page comes from scripts/not-found-head.js. The export keeps it for the
 * day Expo does, and for a server export.
 */
export const generateMetadata = () => metadataFor(notFoundMeta)

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
  const landmark = useRootScreenRole()

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      role={landmark}
    >
      <PageHead {...notFoundMeta} />
      <StateMessage
        testID="not-found"
        icon="link-off"
        tone="error"
        title="Page not found"
        titleLevel={1}
        body="That link does not point at a page."
        actionLabel="Go home"
        actionIcon="home-outline"
        // `dismissTo` takes the dead link out of the history. With the group
        // under it, the home opens in that group; on a deep link, the home
        // takes the dead link's place, as a `replace` would.
        onAction={() => router.dismissTo('/')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
})
