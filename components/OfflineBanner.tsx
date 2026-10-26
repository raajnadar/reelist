import { Typography } from '@rootnative/components'
import { useTheme } from '@rootnative/core'
import { usePathname } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { navigationHidden } from '../lib/navigation'
import { useOnline } from '../lib/network'

/**
 * A strip under the page while the device has no connection.
 *
 * Under the page, not over it: the pages pad their own top edge for the
 * status bar, and a strip above them would add a second gap. At the
 * bottom it sits on the navigation bar, which already takes the bottom
 * inset; beside a rail or a drawer it takes that inset itself. It steps
 * aside with the navigation on the trailer and the gallery, which fill
 * the window.
 *
 * The strip is only the notice. The screens keep reporting a failed
 * request as before, and lib/useResource.ts asks again on its own once the
 * connection is back.
 */
export function OfflineBanner() {
  const online = useOnline()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const hidden = navigationHidden(usePathname())

  if (online || hidden) return null

  return (
    <View
      role="status"
      accessibilityLiveRegion="polite"
      testID="offline-banner"
      style={[
        styles.strip,
        {
          backgroundColor: theme.colors.inverseSurface,
          paddingBottom: 8 + insets.bottom,
        },
      ]}
    >
      <Typography variant="labelLarge" color={theme.colors.inverseOnSurface}>
        You are offline. Films you opened before still show.
      </Typography>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: 16, paddingTop: 8, alignItems: 'center' },
})
