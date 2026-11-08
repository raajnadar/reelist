import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import { linkPreviewSupported } from './linkPreview'
import { pipSupported } from './pip'

/** A feature that has no button of its own, so a reader can miss it. */
export type Tip = {
  id: string
  icon: string
  title: string
  body: string
}

/**
 * What this build and this device can do. Each tip names a feature that works
 * here, or the reader looks for something that is not there.
 */
export type TipContext = {
  os: typeof Platform.OS
  /** The iOS press-and-hold preview of a poster. See lib/linkPreview.ts. */
  linkPreview: boolean
  /** The small trailer window. See lib/pip.ts. */
  pip: boolean
  /** Android 12 and later go to the small window when the reader leaves the app. */
  pipOnHome: boolean
}

const ANDROID_12 = 31

/** On every platform. The share text is built in lib/share.ts. */
const SHARE_NOTE: Tip = {
  id: 'share-note',
  icon: 'share-variant',
  title: 'Share a film you kept',
  body: 'A share sends the rating, the tagline, and a line that says the film is on your watchlist, or that you watched it.',
}

export function tipsFor({ os, linkPreview, pip, pipOnHome }: TipContext): Tip[] {
  if (os === 'web') {
    return [
      {
        id: 'search-key',
        icon: 'magnify',
        title: 'Press / to search',
        body: 'The search opens from any page.',
      },
      {
        id: 'escape-key',
        icon: 'keyboard-esc',
        title: 'Press Esc to close',
        body: 'Esc closes the search, the settings, the filters, a trailer, or a photo.',
      },
      {
        id: 'arrow-keys',
        icon: 'arrow-left-right',
        title: 'Use the arrow keys',
        body: 'When a poster in the carousel has the focus, ← and → move between the films. In the photo viewer, they move between the photos.',
      },
      {
        id: 'carousel-hover',
        icon: 'cursor-default-outline',
        title: 'Point at the carousel to stop it',
        body: 'The carousel stays on a film while the pointer is on its poster.',
      },
      SHARE_NOTE,
    ]
  }

  const tips: Tip[] = []
  if (os === 'android') {
    tips.push({
      id: 'poster-menu',
      icon: 'gesture-tap-hold',
      title: 'Long press a poster',
      body: 'Play the trailer, save the film, or share it, without opening the film page.',
    })
  } else if (linkPreview) {
    tips.push({
      id: 'poster-preview',
      icon: 'gesture-tap-hold',
      title: 'Long press a poster',
      body: 'See a preview of the film page. Play the trailer, save the film, or share it from the menu.',
    })
  }
  if (os === 'android' && pip) {
    tips.push({
      id: 'trailer-window',
      icon: 'picture-in-picture-bottom-right',
      title: 'Keep a trailer playing',
      body: pipOnHome
        ? 'Leave the app while a trailer plays, or press the small window button. The trailer continues in a corner of the screen.'
        : 'Press the small window button above a trailer. The trailer continues in a corner of the screen.',
    })
  }
  tips.push(
    {
      id: 'photo-zoom',
      icon: 'gesture-double-tap',
      title: 'Double tap a photo',
      body: 'Open a photo on a film page, then double tap to zoom in. Swipe down to close the photo.',
    },
    {
      id: 'carousel-hold',
      icon: 'gesture-tap',
      title: 'Hold the carousel',
      body: 'The carousel stays on a film while your finger is on it.',
    },
    SHARE_NOTE,
  )
  return tips
}

export const TIPS: Tip[] = tipsFor({
  os: Platform.OS,
  linkPreview: linkPreviewSupported,
  pip: pipSupported,
  pipOnHome: Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_12,
})

export const STORAGE_KEY = 'reelist.tips.v1'

export type TipsState = {
  /** The reader closed the tips card, or opened the tips page. */
  seen: boolean
  /**
   * Whether the device copy was read. The card and the badge wait for it, so
   * a reader who closed the card does not see it come back for a frame.
   */
  loaded: boolean
}

let state: TipsState = { seen: false, loaded: false }

const listeners = new Set<() => void>()
let touched = false

const set = (next: Partial<TipsState>) => {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

/** The device copy is not trusted input: it can be half written. */
export function parseStored(raw: string | null): Partial<TipsState> {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && 'seen' in value
      ? { seen: value.seen === true }
      : {}
  } catch {
    return {}
  }
}

const hydrate = async () => {
  let raw: string | null = null
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY)
  } catch {
    // Unreadable storage shows the tips again, which costs the reader one tap.
  }
  set({ ...(touched ? {} : parseStored(raw)), loaded: true })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (!state.loaded && listeners.size === 1) void hydrate()
  return () => {
    listeners.delete(listener)
  }
}

const getState = () => state

export function markTipsSeen(): void {
  if (state.seen) return
  touched = true
  set({ seen: true })
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: true })).catch(() => {})
}

export const useTips = (): TipsState =>
  useSyncExternalStore(subscribe, getState, getState)

/**
 * Puts the store back to its start state, for a test. jest.setup.js calls it
 * through a lazy `require`, which Knip cannot follow.
 *
 * @public
 */
export function resetTips(): void {
  state = { seen: false, loaded: false }
  touched = false
  listeners.clear()
}
