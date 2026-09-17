import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { StyleSheet } from 'react-native'
import type { MovieDetail } from '../lib/types'

/** The tagline and the synopsis, under a heading of their own. */
export function DetailOverview({ movie }: { movie: MovieDetail }) {
  const theme = useTheme()

  return (
    <Motion.View
      initial={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
      style={styles.section}
    >
      {/*
        A heading, so the overview is a section like the two rows below it
        rather than a paragraph that starts without warning.
      */}
      <Typography variant="titleMediumEmphasized">Overview</Typography>

      {/*
        The tagline, when the film has one. TMDB sends `""` for a film with
        none, and `lib/api.ts` keeps that sentinel — so this is a line that is
        simply absent rather than an empty row.
      */}
      {movie.tagline ? (
        <Typography
          variant="bodyLarge"
          color={theme.colors.primary}
          style={styles.tagline}
        >
          {movie.tagline}
        </Typography>
      ) : null}

      {movie.overview ? (
        <Typography variant="bodyMedium" style={styles.overview}>
          {movie.overview}
        </Typography>
      ) : (
        <Typography
          variant="bodyMedium"
          color={theme.colors.onSurfaceVariant}
          style={styles.overview}
        >
          No overview yet.
        </Typography>
      )}
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  tagline: { fontStyle: 'italic' },
  overview: { marginTop: 2 },
})
