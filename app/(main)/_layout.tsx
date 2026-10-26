import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { AppNavigation } from '../../components/AppNavigation'

/**
 * Every page that has the navigation around it.
 *
 * A group with a stack of its own, inside the root stack. The search and the
 * settings sheets live in the root stack, above this group, so their scrim
 * dims the navigation as well as the page. A group name is not part of a URL.
 */
export default function MainLayout() {
  return (
    // Outside `<main>`: the navigation is its own landmark, and the page
    // content is what the main one holds.
    <AppNavigation>
      {/*
        One `<main>` for each page of the web export. A crawler and a screen
        reader find the page content by this landmark, and
        `rootnative-seo audit` fails a page that has none. The menus and the
        snackbars stay outside it, in the portal layer.
      */}
      <View role="main" style={styles.main}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </AppNavigation>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1 },
})
