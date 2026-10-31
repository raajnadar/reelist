import { Card } from '@rootnative/components/card'
import { Icon } from '@rootnative/components/icon'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { Link } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { backdropUrl } from '../lib/images'
import type { CollectionLink } from '../lib/types'
import { useServerPainted } from '../lib/useServerPainted'
import { RemoteImage } from './RemoteImage'
import { Scrim, type ScrimStop } from './Scrim'

/** The height of the banner. A strip of the backdrop, not a second hero. */
const HEIGHT = 112

/** Dark at the foot, where the name sits, and clear at the top. */
const BANNER_SCRIM: readonly ScrimStop[] = [
  [0, 0.1],
  [0.5, 0.45],
  [1, 0.8],
]

/**
 * The franchise the film is part of, as one wide card that opens the
 * collection screen.
 *
 * The backdrop of the collection is behind the name, under a scrim so the
 * text reads on any picture. A collection with no backdrop gets the container
 * colour instead, and keeps the same box.
 *
 * Absent for a film that stands alone, so it leaves no gap.
 */
export function CollectionBanner({ collection }: { collection: CollectionLink | null }) {
  const theme = useTheme()
  const painted = useServerPainted()

  if (!collection) return null

  const uri = backdropUrl(collection.backdrop_path)
  const onImage = uri ? '#ffffff' : theme.colors.onSecondaryContainer

  return (
    <Motion.View
      initial={painted ? false : { opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
    >
      <Link href={`/collection/${collection.id}`} asChild>
        <Card
          variant="filled"
          accessibilityLabel={`Part of the ${collection.name}. Opens the collection`}
          testID="collection-banner"
          style={[styles.card, { backgroundColor: theme.colors.secondaryContainer }]}
        >
          {uri ? (
            <>
              <RemoteImage
                uri={uri}
                alt=""
                recyclingKey={`collection-${collection.id}`}
                style={StyleSheet.absoluteFill}
              />
              <Scrim color="#000000" stops={BANNER_SCRIM} />
            </>
          ) : null}
          <View style={styles.text}>
            <Typography variant="labelMedium" color={onImage}>
              Part of
            </Typography>
            <View style={styles.titleRow}>
              <Typography
                variant="titleMediumEmphasized"
                color={onImage}
                numberOfLines={1}
                style={styles.title}
              >
                {collection.name}
              </Typography>
              <Icon source="chevron-right" size={24} color={onImage} />
            </View>
          </View>
        </Card>
      </Link>
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  card: { height: HEIGHT, overflow: 'hidden', justifyContent: 'flex-end' },
  text: { padding: 16, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flex: 1 },
})
