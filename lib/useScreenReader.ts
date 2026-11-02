import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'

/**
 * Whether VoiceOver or TalkBack is on. Always false on the web, where no API
 * tells.
 */
export function useScreenReader() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    // No browser API tells, and react-native-web answers true for every
    // browser, which would read as a screen reader for every visitor.
    if (Platform.OS === 'web') return
    let live = true
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (live) setEnabled(on)
    })
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setEnabled,
    )
    return () => {
      live = false
      subscription.remove()
    }
  }, [])

  return enabled
}
