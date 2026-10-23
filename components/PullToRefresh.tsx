import { useTheme } from '@rootnative/core'
import { RefreshControl, type RefreshControlProps } from 'react-native'

type Props = Omit<RefreshControlProps, 'tintColor' | 'colors' | 'progressBackgroundColor'>

/**
 * The pull to refresh indicator, in the theme colours. `RefreshControl` sits
 * outside the theme, so each colour has to be handed to it. iOS reads
 * `tintColor`; Android reads `colors` and the background.
 *
 * Every other prop must reach `RefreshControl`. On Android and on web the
 * ScrollView clones this element and passes itself in as `children`, with its
 * own `style`. A wrapper that drops them renders no list at all.
 */
export function PullToRefresh(props: Props) {
  const theme = useTheme()

  return (
    <RefreshControl
      {...props}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.surfaceContainerHigh}
    />
  )
}
