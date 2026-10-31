import { Chip } from '@rootnative/components/chip'
import { Icon } from '@rootnative/components/icon'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Link } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { genreIcon } from '../lib/genreIcons'
import type { Genre } from '../lib/types'

/**
 * Every genre as a chip, wrapped over as many lines as the width needs.
 *
 * The home shows the same chips in one scrolling row, as a shortcut beside the
 * film rows. Here the genres are the content, so each one is on screen with no
 * scroll, and the row ends where the last genre is. The chips are the same
 * tonal pills, so the two screens read as one.
 *
 * Renders nothing for an empty list, for the reason GenreChips does: a failed
 * genre request leaves no gap and no error under the film rows above.
 */
export function GenreGrid({ genres }: { genres: Genre[] }) {
  const theme = useTheme()

  if (!genres.length) return null

  return (
    <View style={styles.section} testID="genre-grid">
      <Typography variant="titleMediumEmphasized" level={2} style={styles.heading}>
        Browse by genre
      </Typography>
      <View style={styles.grid}>
        {genres.map((genre) => (
          // A link, so the web renders an anchor a crawler can follow.
          <Link
            key={genre.id}
            href={`/genre/${genre.id}?name=${encodeURIComponent(genre.name)}`}
            asChild
          >
            <Chip
              variant="suggestion"
              leadingIcon={({ size }) => (
                <Icon
                  source={genreIcon(genre.id)}
                  size={size}
                  color={theme.colors.primary}
                />
              )}
              containerColor={theme.colors.surfaceContainerHigh}
              contentColor={theme.colors.onSurface}
              style={styles.chip}
            >
              {genre.name}
            </Chip>
          </Link>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16 },
  heading: { marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // The same pill as the home row, so the two screens match.
  chip: { borderRadius: 999, borderWidth: 0 },
})
