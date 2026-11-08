import { Button } from '@rootnative/components/button'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { Link, type Href } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { BUTTON_SIZE } from '../lib/buttonSize'
import { monthYear, ratingLabel } from '../lib/format'
import { NEW_TAB } from '../lib/share'
import type { Review } from '../lib/types'
import { useServerPainted } from '../lib/useServerPainted'

/**
 * How many lines a review shows before the reader opens it. Five lines hold
 * the first paragraph of most reviews, which is the part that says whether the
 * reviewer liked the film.
 */
const CLIPPED_LINES = 5

/** The TMDB page with every review of the film. */
const reviewsUrl = (movieId: number) =>
  `https://www.themoviedb.org/movie/${movieId}/reviews`

/**
 * What readers on TMDB wrote about the film: up to three reviews, each
 * clipped, and a link to the rest.
 *
 * A review opens in place on a press rather than on a page of its own. The
 * text is the whole of it, so a page would hold nothing more than the card
 * does. The link at the foot goes to TMDB, where the reviews come from and
 * where a reader can write one.
 *
 * Absent for a film with no review, so it leaves no gap.
 */
export function ReviewList({ movieId, reviews }: { movieId: number; reviews: Review[] }) {
  const painted = useServerPainted()

  if (!reviews.length) return null

  return (
    <Motion.View
      initial={painted ? false : { opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
      style={styles.section}
    >
      <Typography variant="titleMediumEmphasized" level={2}>
        Reviews
      </Typography>

      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}

      <Link href={reviewsUrl(movieId) as Href} asChild>
        <Button
          variant="text"
          size={BUTTON_SIZE.inline}
          trailingIcon="open-in-new"
          accessibilityLabel="All reviews on TMDB. Opens in the browser"
          hrefAttrs={NEW_TAB}
          style={styles.more}
        >
          All reviews on TMDB
        </Button>
      </Link>
    </Motion.View>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const rating = ratingLabel(review.rating)
  const date = monthYear(review.created_at)

  return (
    <Pressable
      testID="review-card"
      accessibilityRole="button"
      accessibilityLabel={`Review by ${review.author}`}
      accessibilityHint={open ? 'Shows less of the review' : 'Shows the whole review'}
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((value) => !value)}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: theme.shape.cornerLarge,
        },
      ]}
    >
      <View style={styles.head}>
        <Typography variant="titleSmall" numberOfLines={1} style={styles.author}>
          {review.author}
        </Typography>
        {/*
          The reviewer's own score, in the badge the identity block uses for
          the TMDB average. Absent when the reviewer gave none: a `0` would
          read as the lowest score, not as no score.
        */}
        {rating ? (
          <View
            style={[
              styles.rating,
              {
                backgroundColor: theme.colors.primaryContainer,
                borderRadius: theme.shape.cornerFull,
              },
            ]}
          >
            <Typography variant="labelMedium" color={theme.colors.onPrimaryContainer}>
              {`★ ${rating}`}
            </Typography>
          </View>
        ) : null}
      </View>

      {date ? (
        <Typography variant="labelSmall" color={theme.colors.onSurfaceVariant}>
          {date}
        </Typography>
      ) : null}

      <Typography
        variant="bodyMedium"
        numberOfLines={open ? undefined : CLIPPED_LINES}
        style={styles.content}
      >
        {review.content.trim()}
      </Typography>

      <Typography variant="labelLarge" color={theme.colors.primary}>
        {open ? 'Show less' : 'Read more'}
      </Typography>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  card: { padding: 16, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { flex: 1 },
  rating: { paddingHorizontal: 8, paddingVertical: 2 },
  content: { marginTop: 6, marginBottom: 6 },
  more: { alignSelf: 'flex-start' },
})
