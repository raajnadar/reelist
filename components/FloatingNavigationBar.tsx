import { Badge } from '@rootnative/components/badge'
import { Icon } from '@rootnative/components/icon'
import { useTheme, type IconSource } from '@rootnative/core'
import {
  Motion,
  useBooleanSpring,
  useInterpolatedStyle,
  useSpring,
} from '@rootnative/inertia'
import { useGestureLayer } from '@rootnative/inertia/gesture-layer'
import { useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { KeyDownEvent } from '../lib/useWebKey'

export const FLOATING_BAR_HEIGHT = 64
const SHRUNK_HEIGHT = 48
/**
 * The gap between the full bar and each side of the window. AppNavigation
 * keeps the same gap under the bar.
 */
export const FLOATING_BAR_GAP = 16
/** Wider than this, four items sit too far apart for one thumb. */
export const FLOATING_BAR_MAX_WIDTH = 480
/** The gap between the bar and the content that floats above it. */
export const FLOATING_BAR_ABOVE_GAP = 8
/** The room between the edge of the bar and its buttons, on every side. */
const PADDING = 6
const ITEM_GAP = 4
/** The width of each button in the small bar. */
const SHRUNK_ITEM_WIDTH = 52
/** The focus ring of the library's items: its width, and its gap to the button. */
const RING_WIDTH = 3
const RING_OFFSET = 2

/**
 * The MD3 level 3 shadow, the same as the search pill's. A `boxShadow` string,
 * for the reason given in app/search.tsx.
 */
export const FLOATING_SHADOW =
  '0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15)'

type FloatingBarItem = {
  value: string
  /** The name a screen reader reads. The bar shows the icon alone. */
  label: string
  icon: IconSource
  selectedIcon?: IconSource
  badge?: number
  accessibilityLabel?: string
}

type Props = {
  items: FloatingBarItem[]
  value: string
  onValueChange: (value: string) => void
  /** The size to move to: 0 is full, 1 is small. See lib/floatingBar.ts. */
  shrink: SharedValue<number>
  containerColor: string
  /** The distance from the bottom edge of the window to the bar. */
  bottom: number
  /**
   * Content that floats above the bar, as wide as the full bar. It moves down
   * with the top edge of the bar as the bar shrinks.
   */
  above?: ReactNode
  accessibilityLabel?: string
  testID?: string
}

/**
 * The phone's navigation: a capsule that floats over the page, clear of the
 * window edges, with one icon button for each destination. The lit button
 * fills its share of the capsule.
 *
 * The library's `NavigationBar` is an 80 dp band with a fixed row and a label
 * under each icon, so it cannot shrink. This bar keeps the parts of its items
 * that a reader relies on (the lit state, the badge, the tab roles, the focus
 * ring) and adds a second size. While the reader scrolls down, the bar
 * narrows and grows shorter. A scroll up brings it back to full size.
 * `@rootnative/components` has no floating bar yet (DX feedback R44). Use the
 * library's when it ships.
 *
 * The bar grows again when a button gets the keyboard focus, as the library's
 * hide-on-scroll bars come back.
 */
export function FloatingNavigationBar({
  items,
  value,
  onValueChange,
  shrink,
  containerColor,
  bottom,
  above,
  accessibilityLabel,
  testID,
}: Props) {
  const theme = useTheme()
  const progress = useSpring(shrink, 'resize')
  const [room, setRoom] = useState(0)
  const onTrackLayout = (event: LayoutChangeEvent) =>
    setRoom(event.nativeEvent.layout.width - 2 * FLOATING_BAR_GAP)

  const full = Math.min(room, FLOATING_BAR_MAX_WIDTH)
  const small = Math.min(
    items.length * SHRUNK_ITEM_WIDTH + (items.length - 1) * ITEM_GAP + 2 * PADDING,
    full,
  )
  const height = [FLOATING_BAR_HEIGHT, SHRUNK_HEIGHT]
  // Until the track has a width, the static width of styles.capsule holds: on
  // the static web page, the server lays out nothing.
  const capsuleStyle = useInterpolatedStyle(
    progress,
    full > 0 ? { height, width: [full, small] } : { height },
  )

  return (
    <View style={[styles.track, { bottom }]} onLayout={onTrackLayout}>
      {above}
      <Motion.View
        role="tablist"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={[
          styles.capsule,
          { backgroundColor: containerColor, borderRadius: theme.shape.cornerFull },
          capsuleStyle,
        ]}
      >
        {items.map((item) => (
          <BarItem
            key={item.value}
            item={item}
            selected={item.value === value}
            onPress={() => onValueChange(item.value)}
            onFocus={() => shrink.set(0)}
            testID={testID && `${testID}-item-${item.value}`}
          />
        ))}
      </Motion.View>
    </View>
  )
}

type ItemProps = {
  item: FloatingBarItem
  selected: boolean
  onPress: () => void
  onFocus: () => void
  testID?: string
}

function BarItem({ item, selected, onPress, onFocus, testID }: ItemProps) {
  const theme = useTheme()
  const content = selected
    ? theme.colors.onSecondaryContainer
    : theme.colors.onSurfaceVariant
  const radius = { borderRadius: theme.shape.cornerFull }

  const lit = useBooleanSpring(selected, 'press')
  const indicatorStyle = useInterpolatedStyle(lit, { opacity: [0, 1], scaleX: [0.4, 1] })
  const {
    style: layerStyle,
    handlers,
    states,
  } = useGestureLayer(
    {
      rest: { opacity: 0 },
      hovered: { opacity: 0.08 },
      focused: { opacity: 0.1 },
      pressed: { opacity: 0.1 },
    },
    { transition: 'hover' },
  )
  const ringStyle = useInterpolatedStyle(states.focusVisible, { opacity: [0, 1] })

  // react-native-web presses a tab on Enter only. The library's items take
  // Space as well, as a tab does in a browser.
  const onKeyDown = (event: KeyDownEvent) => {
    if (event.nativeEvent.key !== ' ' || event.nativeEvent.repeat) return
    event.preventDefault?.()
    onPress()
  }
  const keyProps = Platform.OS === 'web' ? ({ onKeyDown } as const) : {}

  const icon = (
    <Icon
      source={selected && item.selectedIcon !== undefined ? item.selectedIcon : item.icon}
      color={content}
    />
  )

  return (
    <Pressable
      role="tab"
      aria-selected={selected}
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      testID={testID}
      onPress={onPress}
      {...handlers}
      onFocus={(event) => {
        handlers.onFocus(event)
        onFocus()
      }}
      {...keyProps}
      style={styles.item}
    >
      <Motion.View
        style={[
          styles.layer,
          radius,
          { backgroundColor: theme.colors.secondaryContainer },
          indicatorStyle,
        ]}
      />
      <Motion.View
        style={[styles.layer, radius, { backgroundColor: content }, layerStyle]}
      />
      <Motion.View
        style={[styles.ring, radius, { borderColor: theme.colors.secondary }, ringStyle]}
      />
      <View aria-hidden>
        {item.badge === undefined ? icon : <Badge label={item.badge}>{icon}</Badge>}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // The track spans the window, so the bar can measure the room it has. Its
  // empty sides let a touch through to the page.
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: FLOATING_BAR_ABOVE_GAP,
    paddingHorizontal: FLOATING_BAR_GAP,
    pointerEvents: 'box-none',
  },
  capsule: {
    width: '100%',
    maxWidth: FLOATING_BAR_MAX_WIDTH,
    height: FLOATING_BAR_HEIGHT,
    flexDirection: 'row',
    gap: ITEM_GAP,
    padding: PADDING,
    boxShadow: FLOATING_SHADOW,
  },
  // On the web the browser draws a ring of its own as an outline, beside the
  // drawn ring. See CarouselCard.
  item: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  layer: StyleSheet.absoluteFill,
  ring: {
    position: 'absolute',
    top: -RING_OFFSET,
    left: -RING_OFFSET,
    right: -RING_OFFSET,
    bottom: -RING_OFFSET,
    borderWidth: RING_WIDTH,
  },
})
