import { Button } from '@rootnative/components/button'
import { Skeleton } from '@rootnative/components/skeleton'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, Stagger } from '@rootnative/inertia'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { lifeSpan } from '../lib/format'
import { profileUrl } from '../lib/images'
import { STAGGER_INTERVAL } from '../lib/motion'
import type { PersonDetail } from '../lib/types'
import { RemoteImage } from './RemoteImage'

/**
 * Who the person is: the photo, the name, the facts, and the biography.
 *
 * The placeholder lives in this file for the reason DetailIdentity's does: the
 * two are one arrangement, and a placeholder of a different shape would reflow
 * the screen the moment the request lands.
 */

/**
 * How long a biography has to be before the screen folds it.
 *
 * A character count rather than a measured line count. `onTextLayout` reports
 * the real number, but only after the text has been laid out — so the block
 * would draw open and collapse on the next frame. TMDB biographies run from two
 * sentences to several thousand words, and this is far enough along that scale
 * to separate the two.
 */
const LONG_BIOGRAPHY = 420

/** The lines a folded biography shows. */
const COLLAPSED_LINES = 6

type Props = {
  person: PersonDetail
  photoWidth: number
  /** The wide arrangement, from the `expanded` breakpoint up. */
  wide: boolean
}

export function PersonProfile({ person, photoWidth, wide }: Props) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)

  // `h632` rather than the `w185` the cast card uses: this is the one picture
  // the screen is built around, and the card size is visibly soft at this width.
  const photo = profileUrl(person.profile_path, 'h632')

  /**
   * The one-line summary beside the name.
   *
   * Both parts are absent for a person TMDB holds little on, so they are joined
   * rather than laid out: a separator printed around nothing is worse than a
   * line that is simply shorter.
   */
  const facts = [person.known_for_department, lifeSpan(person.birthday, person.deathday)]
    .filter(Boolean)
    .join(' · ')

  const long = person.biography.length > LONG_BIOGRAPHY

  return (
    <Motion.View
      initial={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
      style={styles.profile}
    >
      <View style={styles.identity}>
        {/*
          TMDB has no photo on file for many of the people it lists, which is
          why the picture is a branch rather than an image with a fallback
          source. The text column then takes the whole width, because an empty
          rectangle reads as a broken image.
        */}
        {photo ? (
          <RemoteImage
            testID="person-photo"
            uri={photo}
            recyclingKey={String(person.id)}
            priority="high"
            style={[
              styles.photo,
              {
                width: photoWidth,
                borderRadius: theme.shape.cornerLarge,
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          />
        ) : null}

        <View style={styles.identityText}>
          {/* The larger variant only where there is room for it, the same rule
              the film masthead follows: on a phone the headline wraps a long
              name to three lines. */}
          <Typography variant={wide ? 'headlineLargeEmphasized' : 'titleLargeEmphasized'}>
            {person.name}
          </Typography>

          {facts ? (
            <Typography
              testID="person-facts"
              variant="labelLarge"
              color={theme.colors.onSurfaceVariant}
            >
              {facts}
            </Typography>
          ) : null}

          {person.place_of_birth ? (
            <Typography variant="labelLarge" color={theme.colors.onSurfaceVariant}>
              {person.place_of_birth}
            </Typography>
          ) : null}
        </View>
      </View>

      <View style={styles.biography}>
        <Typography variant="titleMediumEmphasized">Biography</Typography>

        {person.biography ? (
          <Typography
            testID="person-biography"
            variant="bodyMedium"
            numberOfLines={long && !expanded ? COLLAPSED_LINES : undefined}
          >
            {person.biography}
          </Typography>
        ) : (
          <Typography variant="bodyMedium" color={theme.colors.onSurfaceVariant}>
            No biography yet.
          </Typography>
        )}

        {/*
          The control is absent for a short biography rather than disabled. A
          "Show more" under three sentences would promise text that is already
          on screen.
        */}
        {long ? (
          <View style={styles.toggle}>
            <Button variant="text" size="s" onPress={() => setExpanded((open) => !open)}>
              {expanded ? 'Show less' : 'Show more'}
            </Button>
          </View>
        ) : null}
      </View>
    </Motion.View>
  )
}

/** The same box, before the person arrives. */
export function PersonProfileSkeleton({ photoWidth }: { photoWidth: number }) {
  const theme = useTheme()

  return (
    <View style={styles.profile}>
      <View style={styles.identity}>
        {/*
          The ratio lives on the wrapper, not the block: Skeleton writes a
          concrete height ahead of the caller's style, and in React Native an
          explicit height beats `aspectRatio`.
        */}
        <View
          style={[
            styles.photoPlaceholder,
            { width: photoWidth, borderRadius: theme.shape.cornerLarge },
          ]}
        >
          <Skeleton height="100%" style={{ borderRadius: theme.shape.cornerLarge }} />
        </View>

        <View style={styles.identityText}>
          {/* `<Stagger>` owns the cascade, so no block carries a delay of its
              own. It derives each one from render order. */}
          <Stagger interval={STAGGER_INTERVAL} delay={STAGGER_INTERVAL}>
            <Skeleton height={28} width="80%" />
            <Skeleton height={18} width="55%" />
            <Skeleton height={18} width="45%" />
          </Stagger>
        </View>
      </View>

      <View style={styles.biography}>
        <Skeleton height={20} width={120} />
        <Skeleton height={72} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  profile: { gap: 24 },
  // `flex-start`, not the `flex-end` the film masthead uses: there is no
  // backdrop for the picture to overlap here, so the name sits at the top of
  // the photo rather than at its foot.
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  // `flexBasis: 0` with `flex: 1`: the column takes the leftover width rather
  // than sizing to its content, so a long name cannot squeeze the photo.
  identityText: { flex: 1, flexBasis: 0, gap: 6 },
  // 2:3, the ratio TMDB uses for a profile image as well as a poster. The
  // hairline separates the picture from a dark page behind it.
  photo: { aspectRatio: 2 / 3, borderWidth: StyleSheet.hairlineWidth },
  // The loading stand-in for it: the same box, clipped so the block inside
  // keeps the corner.
  photoPlaceholder: { aspectRatio: 2 / 3, overflow: 'hidden' },
  biography: { gap: 8 },
  // The button pads itself, so it needs no left inset to line up with the text
  // above it — `flex-start` keeps it at its own width instead of a full-width
  // banner.
  toggle: { alignSelf: 'flex-start', marginLeft: -12 },
})
