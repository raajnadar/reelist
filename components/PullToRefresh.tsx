import { useTheme } from '@rootnative/core'
import { RefreshControl } from 'react-native'

type Props = {
  refreshing: boolean
  onRefresh: () => void
}

/**
 * The pull to refresh indicator, in the theme colours. `RefreshControl` sits
 * outside the theme, so each colour has to be handed to it. iOS reads
 * `tintColor`; Android reads `colors` and the background.
 */
export function PullToRefresh({ refreshing, onRefresh }: Props) {
  const theme = useTheme()

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.surfaceContainerHigh}
    />
  )
}
