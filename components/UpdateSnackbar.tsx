import { useSnackbar } from '@rootnative/components/snackbar'
import { reloadAsync, useUpdates } from 'expo-updates'
import { useEffect, useRef } from 'react'
import { Image } from 'react-native'

// The same look as the splash screen in app.json, so the restart does not
// flash the default white reload screen.
function reloadScreen() {
  const splash = Image.resolveAssetSource(require('../assets/splash-icon.png'))
  return {
    backgroundColor: '#4C0519',
    // expo-updates draws the image at its pixel size in dp (1024 px gives
    // 1024 dp), so give the 100 dp width of the expo-splash-screen default.
    image: splash && { url: splash.uri, width: 100, height: 106 },
    fade: true,
  }
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
        reloadAsync({ reloadScreenOptions: reloadScreen() }).catch(() => {})
      },
    })
  }, [isUpdatePending, snackbar])

  return null
}
