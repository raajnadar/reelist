import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'

/**
 * Whether a link can carry the native iOS press-and-hold preview and menu.
 *
 * Expo Router draws the link through a native view when it has `Link.Preview`
 * or `Link.Menu` as a child, and only in a bridgeless (new architecture)
 * app that has the module. Without that view, the link draws nothing at all,
 * and the card inside it is gone. That is the case in a test, where the
 * module is a mock and there is no bridge, and in a build without the
 * module. The card then keeps its plain link.
 */
export const linkPreviewSupported =
  Platform.OS === 'ios' &&
  (globalThis as { RN$Bridgeless?: boolean }).RN$Bridgeless === true &&
  requireOptionalNativeModule('ExpoRouterNativeLinkPreview') !== null
