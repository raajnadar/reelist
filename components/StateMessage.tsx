import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Button } from '@rootnative/components/button'
import { Typography } from '@rootnative/components/typography'
import {
  useIconResolver,
  useTheme,
  type IconRenderProps,
  type IconResolver,
  type IconSource,
} from '@rootnative/core'
import { Motion, Stagger } from '@rootnative/inertia'
import { isValidElement, type ComponentProps, type ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

/** Milliseconds between the badge, the text, and the action. */
const STAGGER_INTERVAL = 60

const BADGE_SIZE = 72
const ICON_SIZE = 32

/**
 * The widest the two lines of text ever grow.
 *
 * The setup instruction from MissingProxyUrlError is the longest string any
 * screen passes here. Without a cap it runs the full width of a desktop window
 * as one line, and a centred paragraph is hardest to read when it is widest.
 */
const MAX_TEXT_WIDTH = 340

/**
 * Resolves an `IconSource` the way every RootNative component does.
 *
 * The library exports no standalone icon component, so this repeats the three
 * cases its props accept: a name for the theme resolver, a ready element, and a
 * render function. Without the resolver lookup an app-wide icon set would apply
 * to every control on the screen except this one.
 */
function renderIcon(
  source: IconSource,
  props: IconRenderProps,
  resolver: IconResolver | null,
): ReactNode {
  if (typeof source === 'string') {
    if (resolver) return resolver(source, props)
    // The same default the library falls back to when no resolver is set. The
    // cast is the one the library also makes: `IconSource` is a plain string,
    // and MaterialCommunityIcons types `name` as its own glyph union.
    const name = source as ComponentProps<typeof MaterialCommunityIcons>['name']
    return <MaterialCommunityIcons name={name} size={props.size} color={props.color} />
  }
  if (typeof source === 'function') return source(props)
  if (isValidElement(source)) return source
  return null
}

/**
 * `error` paints the badge in the error container, `neutral` in a plain
 * surface. The distinction is the badge alone — the text stays `onSurface` in
 * both, because a whole paragraph in the error colour reads as an alarm rather
 * than as a sentence.
 */
type Tone = 'error' | 'neutral'

type Props = {
  /** The picture above the headline. A name, an element, or a render function. */
  icon: IconSource
  /** One short line that says what happened. */
  title: string
  /** The detail under it: the message from the failure, or the prompt. */
  body?: string
  tone?: Tone
  /** The label of the single action. Omit it, and the block carries no button. */
  actionLabel?: string
  actionIcon?: IconSource
  onAction?: () => void
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * The one block every screen uses for a failure, an empty result, and a prompt.
 *
 * Each screen used to print the bare message in the error colour, centred, with
 * no way to recover: a dropped request ended the screen, and the only way back
 * was to leave and return. This gives the three states one shape — a badge, a
 * headline, the detail, and at most one action — so a reader learns it once.
 *
 * The root is a `Motion.View` with an `exit`, so it belongs directly under a
 * `<Presence>` and needs a `key` from the caller like any other child of one.
 */
export function StateMessage({
  icon,
  title,
  body,
  tone = 'neutral',
  actionLabel,
  actionIcon,
  onAction,
  style,
  testID,
}: Props) {
  const theme = useTheme()
  const resolver = useIconResolver()

  const badge =
    tone === 'error'
      ? { container: theme.colors.errorContainer, content: theme.colors.onErrorContainer }
      : {
          container: theme.colors.surfaceContainerHighest,
          content: theme.colors.onSurfaceVariant,
        }

  // Both are required. A label with no handler would draw a button that answers
  // nothing, and a handler with no label has nothing to press.
  const action = actionLabel && onAction ? { actionLabel, onAction } : null

  return (
    <Motion.View
      testID={testID}
      exit={{ opacity: 0 }}
      transition="exit"
      style={[styles.root, style]}
    >
      {/*
        `<Stagger>` owns the cascade, so no block below carries a delay of its
        own — the same arrangement the detail screen uses. It derives each delay
        from render order, so the absent button cannot leave a gap in it.
      */}
      <Stagger interval={STAGGER_INTERVAL}>
        {/*
          The badge grows rather than rises. It is the one round shape in the
          block, and a scale reads as the block settling into place, where a
          fourth vertical slide would read as a list of three moving parts.
        */}
        <Motion.View
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition="enter"
          style={[
            styles.badge,
            { backgroundColor: badge.container, borderRadius: theme.shape.cornerFull },
          ]}
        >
          {renderIcon(icon, { size: ICON_SIZE, color: badge.content }, resolver)}
        </Motion.View>

        {/* The two lines move together: they are one sentence split by weight,
            and staggering them would read as two separate announcements. */}
        <Motion.View
          initial={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition="enter"
          style={styles.text}
        >
          <Typography variant="titleMediumEmphasized" style={styles.centre}>
            {title}
          </Typography>

          {body ? (
            <Typography
              testID={testID ? `${testID}-body` : undefined}
              variant="bodyMedium"
              color={theme.colors.onSurfaceVariant}
              style={styles.centre}
            >
              {body}
            </Typography>
          ) : null}
        </Motion.View>

        {action ? (
          <Motion.View
            initial={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition="enter"
            style={styles.action}
          >
            {/*
              Tonal, not filled. The screen behind this block holds no other
              control, so the action needs no contest for attention — and a
              filled button on an error state reads as the thing that went
              wrong rather than the thing that fixes it.
            */}
            <Button
              variant="tonal"
              size="m"
              leadingIcon={actionIcon}
              onPress={action.onAction}
            >
              {action.actionLabel}
            </Button>
          </Motion.View>
        ) : null}
      </Stagger>
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  // `flex: 1` rather than a top margin: the block centres in whatever room the
  // screen leaves it, so it sits in the same place under a tall app bar and
  // under none.
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { alignItems: 'center', gap: 6, maxWidth: MAX_TEXT_WIDTH },
  centre: { textAlign: 'center' },
  // The 16 the container already gives, plus 8: an action needs more room above
  // it than the sentence it answers.
  action: { marginTop: 8 },
})

export type { Props as StateMessageProps }
