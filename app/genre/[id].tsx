import { AppBar } from '@rootnative/components/appbar'
import { useTheme } from '@rootnative/core'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'

/**
 * The films in one genre.
 *
 * A placeholder for now: it claims the route so the chips on the home screen
 * type-check and navigate. Phase 4 adds the grid and the paging.
 */
export default function GenreScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { name } = useLocalSearchParams<{ id: string; name?: string }>()

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <AppBar
        title={name ?? 'Genre'}
        insetTop
        canGoBack
        // Matches search and detail: `router.back` alone dead-ends when this
        // screen is the first entry in the history, as it is on a deep link.
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
})
