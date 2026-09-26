import { useThemeMode } from '@rootnative/core'
import { BlurView } from 'expo-blur'
import { Platform, Pressable, StyleSheet } from 'react-native'

/**
 * How strong the blur is, from 1 to 100.
 *
 * The screen below has to stay readable as a screen — the reader should see
 * that the film rows are still there — but not as text. On the web, 45 blurs
 * the titles into colour and keeps the posters as shapes; the web view also
 * paints a tint on top of the blur, which does part of the work. iOS paints no
 * such tint, and at 45 a bright poster showed through the sheet as a band of
 * colour between two result cards, so native gets more. On Android the number
 * also sets the opacity of the fallback tint.
 */
const GLASS_INTENSITY = Platform.OS === 'web' ? 45 : 70

type Props = {
  /** Called on a press anywhere on the sheet. */
  onPress: () => void
  testID?: string
}

/**
 * A frosted sheet over the screen below, for a transparent modal.
 *
 * Every platform draws it differently. iOS blurs natively. The web uses the
 * `backdrop-filter` CSS rule. Android blurs on SDK 31 and later through
 * `blurMethod`, and on older versions draws the translucent tint that expo-blur
 * ships as its fallback. The tint follows the resolved scheme, so a dark theme
 * gets a dark sheet.
 *
 * A press on it dismisses the modal, the way the about screen's scrim does, and
 * it is hidden from screen readers for the same reason: the modal keeps a close
 * button, and a second control with the same meaning would only confuse.
 */
export function GlassLayer({ onPress, testID }: Props) {
  const { scheme } = useThemeMode()

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      focusable={false}
      style={styles.layer}
    >
      <BlurView
        intensity={GLASS_INTENSITY}
        tint={scheme}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={styles.layer}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
})
