import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  impactAsync,
  performAndroidHapticsAsync,
  selectionAsync,
} from 'expo-haptics'
import { Platform } from 'react-native'
import { haptic } from './haptics'

jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
}))

const os = Platform.OS
const version = Platform.Version

const setPlatform = (OS: typeof Platform.OS, Version: number | string) => {
  Object.defineProperty(Platform, 'OS', { value: OS, configurable: true })
  Object.defineProperty(Platform, 'Version', { value: Version, configurable: true })
}

afterEach(() => {
  setPlatform(os, version)
  jest.clearAllMocks()
})

describe('haptic on iOS', () => {
  beforeEach(() => setPlatform('ios', '18.0'))

  it('plays a light impact for a save and a soft one for an unsave', () => {
    haptic('save')
    haptic('unsave')
    expect(impactAsync).toHaveBeenNthCalledWith(1, ImpactFeedbackStyle.Light)
    expect(impactAsync).toHaveBeenNthCalledWith(2, ImpactFeedbackStyle.Soft)
  })

  it('plays the selection haptic for a filter pick', () => {
    haptic('select')
    expect(selectionAsync).toHaveBeenCalledTimes(1)
  })
})

describe('haptic on Android', () => {
  it('uses the toggle and segment haptics on Android 14', () => {
    setPlatform('android', 34)
    haptic('save')
    haptic('unsave')
    haptic('select')
    expect(jest.mocked(performAndroidHapticsAsync).mock.calls).toEqual([
      [AndroidHaptics.Toggle_On],
      [AndroidHaptics.Toggle_Off],
      [AndroidHaptics.Segment_Tick],
    ])
  })

  it('falls back to the context click before Android 14', () => {
    setPlatform('android', 33)
    haptic('save')
    expect(performAndroidHapticsAsync).toHaveBeenCalledWith(AndroidHaptics.Context_Click)
  })

  it('never uses the Vibrator haptics, which need the blocked VIBRATE permission', () => {
    setPlatform('android', 34)
    haptic('save')
    haptic('select')
    expect(impactAsync).not.toHaveBeenCalled()
    expect(selectionAsync).not.toHaveBeenCalled()
  })
})

it('drops a failed haptic', async () => {
  setPlatform('android', 34)
  jest.mocked(performAndroidHapticsAsync).mockRejectedValueOnce(new Error('No haptics'))
  expect(() => haptic('save')).not.toThrow()
  // An unhandled rejection would fail the test after this tick.
  await Promise.resolve()
})
