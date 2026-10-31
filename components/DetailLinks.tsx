import { Button } from '@rootnative/components/button'
import { Motion } from '@rootnative/inertia'
import { Link, type Href } from 'expo-router'
import { StyleSheet } from 'react-native'
import { BUTTON_SIZE } from '../lib/buttonSize'
import { externalLinks } from '../lib/externalLinks'
import { NEW_TAB } from '../lib/share'
import type { MovieDetail } from '../lib/types'
import { useServerPainted } from '../lib/useServerPainted'

/**
 * The pages off the site that the film has: IMDb and the official site.
 *
 * Plain links, so the web renders an anchor a crawler can follow and a reader
 * can open in a new tab. Native opens the browser. `text` buttons, because the
 * row sits under the sections of the page and must not compete with the
 * trailer button at the top.
 *
 * Absent for a film with neither, so it leaves no gap.
 */
export function DetailLinks({
  movie,
}: {
  movie: Pick<MovieDetail, 'imdb_id' | 'homepage'>
}) {
  const painted = useServerPainted()
  const links = externalLinks(movie)

  if (!links.length) return null

  return (
    <Motion.View
      testID="detail-links"
      initial={painted ? false : { opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
      style={styles.row}
    >
      {links.map((link) => (
        <Link key={link.id} href={link.url as Href} asChild>
          <Button
            variant="outlined"
            size={BUTTON_SIZE.inline}
            leadingIcon={link.icon}
            trailingIcon="open-in-new"
            accessibilityLabel={`${link.label}. Opens in the browser`}
            hrefAttrs={NEW_TAB}
          >
            {link.label}
          </Button>
        </Link>
      ))}
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  // `alignSelf` keeps the buttons at their own width, for the reason
  // DetailActions gives.
  row: { alignSelf: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
