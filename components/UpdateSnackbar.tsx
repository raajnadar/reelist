import { useSnackbar } from '@rootnative/components/snackbar'
import { reloadAsync, useUpdates } from 'expo-updates'
import { useEffect, useRef } from 'react'

// The same look as the splash screen in app.json, so the restart does not
// flash the default white reload screen.
const RELOAD_SCREEN = {
  backgroundColor: '#4C0519',
  image: require('../assets/splash-icon.png'),
  fade: true,
}

/**
 * Offers a restart when an EAS Update finishes its download.
 *
 * expo-updates checks for an update at each cold start and downloads it in
 * the background. Without this offer, the new code runs only at the next cold
 * start. A reader who closes the snackbar gets the update at that start.
 * The web version is in UpdateSnackbar.web.tsx.
 */
export function UpdateSnackbar() {
  const snackbar = useSnackbar()
  const { isUpdatePending } = useUpdates()
  const offered = useRef(false)

  useEffect(() => {
    if (!isUpdatePending || offered.current) return
    offered.current = true
    snackbar.show({
      message: 'A new version is ready',
      actionLabel: 'Restart',
      showCloseIcon: true,
      onAction: () => {
        reloadAsync({ reloadScreenOptions: RELOAD_SCREEN }).catch(() => {})
      },
    })
  }, [isUpdatePending, snackbar])

  return null
}
