import { Card } from '@rootnative/components/card'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { Image, StyleSheet, View } from 'react-native'
import { profileUrl } from '../lib/images'
import { entranceTransition } from '../lib/motion'
import type { CastMember } from '../lib/types'

// Narrower than CARD_WIDTH in MovieCard. A headshot carries a name and a role
// rather than a title and a rating, and a poster-width card would fit three
// faces on a phone where five belong.
export const CAST_CARD_WIDTH = 120

export function CastCard({ member, index = 0 }: { member: CastMember; index?: number }) {
  const theme = useTheme()
  const uri = profileUrl(member.profile_path)

  return (
    // The same split as MovieCard: Card owns the M3 surface, Motion.View owns
    // the movement.
    <Motion.View
      initial={{ opacity: 0, translateY: 24 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={entranceTransition(index)}
      style={styles.slot}
    >
      {/*
        No `onPress`, and so no `gesture` layer either. There is no screen for
        one person yet, and a card that lifts under a pointer but answers no tap
        reads as broken. Card renders a plain View without a press handler.
      */}
      <Card variant="filled" style={styles.card}>
        {/* 2:3, the ratio TMDB uses for a profile image as well as a poster.
          The Image carries its own width and ratio for the reason MovieCard
          explains: React Native does not measure a remote image before it
          loads, so an Image with no size lays out at zero height. */}
        <Card.Media aspectRatio={2 / 3}>
          {uri ? (
            <Image
              testID="cast-photo"
              source={{ uri }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[styles.fallback, { backgroundColor: theme.colors.surfaceVariant }]}
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
  )
}

const styles = StyleSheet.create({
  slot: { width: CAST_CARD_WIDTH },
  card: { width: CAST_CARD_WIDTH },
  photo: { width: '100%', aspectRatio: 2 / 3 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
