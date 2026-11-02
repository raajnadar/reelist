import { Icon } from '@rootnative/components/icon'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { StyleSheet, type LayoutChangeEvent } from 'react-native'
import { FLOATING_BAR_MAX_WIDTH, FLOATING_SHADOW } from './FloatingNavigationBar'

/**
 * A card that floats over the bottom of the page while the device has no
 * connection.
 *
 * AppNavigation places it: on a phone above the floating bar, as wide as
 * the full bar, and beside a rail or a drawer at the bottom of the page. It
 * measures the card through `onLayout`, so the lists and the snackbar clear
 * it. It steps aside with the navigation on the trailer and the gallery,
 * which fill the window.
 *
 * A touch goes through the card to the page under it: the card is the
 * notice only. The screens keep reporting a failed request as before, and
 * lib/useResource.ts asks again on its own once the connection is back.
 */
export function OfflineBanner({
  onLayout,
}: {
  onLayout?: (event: LayoutChangeEvent) => void
}) {
  const theme = useTheme()

  return (
    <Motion.View
      role="status"
      accessibilityLiveRegion="polite"
      testID="offline-banner"
      onLayout={onLayout}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition="exit"
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.inverseSurface,
          borderRadius: theme.shape.cornerLarge,
        },
      ]}
    >
      <Icon source="cloud-off-outline" size={20} color={theme.colors.inverseOnSurface} />
      <Typography
        variant="labelLarge"
        color={theme.colors.inverseOnSurface}
        style={styles.text}
      >
        You are offline. Films you opened before still show.
      </Typography>
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: FLOATING_BAR_MAX_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: FLOATING_SHADOW,
    pointerEvents: 'none',
  },
  // The text wraps beside the icon on a narrow window.
  text: { flexShrink: 1 },
})
