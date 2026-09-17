import { Card } from '@rootnative/components/card'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import {
  Motion,
  useInterpolatedStyle,
  useMotionValue,
  type SharedValue,
} from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { profileUrl } from '../lib/images'
import { RemoteImage } from './RemoteImage'
import { cascadeWindow, entranceTransition } from '../lib/motion'
import type { CastMember } from '../lib/types'

// Narrower than CARD_WIDTH in MovieCard. A headshot carries a name and a role
// rather than a title and a rating, and a poster-width card would fit three
// faces on a phone where five belong.
export const CAST_CARD_WIDTH = 120

type Props = {
  member: CastMember
  index?: number
  /**
   * The parent row's 0-1 in-view sweep, when the row drives the entrance.
   *
   * Given one, the card takes its slice of the sweep (see cascadeWindow) and
   * animates when the row reaches the screen. Without one it falls back to the
   * mount stagger, which is correct for a card that stands on its own.
   */
  progress?: SharedValue<number>
}

export function CastCard({ member, index = 0, progress }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const uri = profileUrl(member.profile_path)

  // The hook runs either way — a hook cannot be conditional — so a resting 1
  // stands in when there is no row. That resolves to the end of the range, so
  // the style below is inert on the fallback path and `animate` owns the
  // movement instead.
  const resting = useMotionValue(1)
  const entrance = useInterpolatedStyle(
    progress ?? resting,
    { opacity: [0, 1], translateY: [24, 0] },
    { inputRange: cascadeWindow(index) },
  )

  return (
    /*
      Two nested elements, the same arrangement MovieCard spells out: the
      entrance and the gesture layer both write `transform`, so one element
      cannot hold both. The outer owns the entrance, the inner owns the touch
      response.
    */
    <Motion.View style={progress ? [styles.slot, entrance] : styles.slot}>
      <Motion.View
        initial={progress ? undefined : { opacity: 0, translateY: 24 }}
        animate={progress ? undefined : { opacity: 1, translateY: 0 }}
        // `hovered` is a no-op on native and drives the web pointer state; the
        // one declaration covers both platforms.
        gesture={{
          hovered: { scale: 1.04, translateY: -6 },
          pressed: { scale: 0.96 },
        }}
        // The stagger delay stays on the entrance keys. On the gesture layers
        // it would delay the answer to a tap.
        transition={
          progress
            ? { pressed: 'press', hovered: 'hover' }
            : { ...entranceTransition(index), pressed: 'press', hovered: 'hover' }
        }
      >
        {/*
          The card opens the person screen, which is what earns it the gesture
          layer above: a card that lifts under a pointer has to answer the tap
          that follows.

          The label carries the role as well as the name, because the two lines
          under the photo are read together and a screen reader that announced
          only the name would drop the reason the person is on this screen.
        */}
        <Card
          variant="filled"
          style={styles.card}
          onPress={() => router.push(`/person/${member.id}`)}
          accessibilityLabel={
            member.character ? `${member.name}. ${member.character}` : member.name
          }
        >
          {/* 2:3, the ratio TMDB uses for a profile image as well as a poster.
          The image carries its own width and ratio for the reason MovieCard
          explains: a remote picture has no measurable size until it loads, so
          one with no size lays out at zero height. */}
          <Card.Media aspectRatio={2 / 3}>
            {uri ? (
              <RemoteImage
                testID="cast-photo"
                uri={uri}
                recyclingKey={String(member.id)}
                style={styles.photo}
              />
            ) : (
              <View
                style={[
                  styles.fallback,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <Typography variant="labelSmall" color={theme.colors.onSurfaceVariant}>
                  No photo
                </Typography>
              </View>
            )}
          </Card.Media>

          <Card.Content>
            {/* Both lines hold a fixed height, for the reason MovieCard's title
            does: numberOfLines caps the text but reserves no space, and a row
            of cards sized by their longest name goes ragged along the bottom.
            The role line needs it more than the name does — TMDB sends an empty
            character for an uncredited part, and an empty Typography collapses
            to nothing. */}
            <Typography
              variant="labelLargeEmphasized"
              numberOfLines={2}
              style={{ height: theme.typography.labelLargeEmphasized.lineHeight * 2 }}
            >
              {member.name}
            </Typography>
            <Typography
              testID="cast-character"
              variant="labelSmall"
              color={theme.colors.onSurfaceVariant}
              numberOfLines={1}
              style={{ height: theme.typography.labelSmall.lineHeight }}
            >
              {member.character}
            </Typography>
          </Card.Content>
        </Card>
      </Motion.View>
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  slot: { width: CAST_CARD_WIDTH },
  card: { width: CAST_CARD_WIDTH },
  photo: { width: '100%', aspectRatio: 2 / 3 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
