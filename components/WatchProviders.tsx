import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { logoUrl } from '../lib/images'
import type { WatchProvider, WatchProviders as Providers } from '../lib/types'
import { RemoteImage } from './RemoteImage'

/**
 * The tile size for one service logo. TMDB serves logos square, and at this
 * size a phone fits seven across the body with room for the gaps.
 */
const TILE = 44

/**
 * The three groups, in the order the row prints them. A subscription is what
 * most readers look for first, so it leads.
 */
const GROUPS: { key: keyof Omit<Providers, 'link'>; label: string }[] = [
  { key: 'stream', label: 'Stream' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
]

/**
 * Where the film can be watched, as a section of logo tiles.
 *
 * Each tile opens the TMDB "where to watch" page for the film. TMDB gives no
 * deep link into each service, so one page is the best answer and every tile
 * opens the same one. The page lists the services by region, so the reader
 * can also see a region other than the one the app reads.
 *
 * The JustWatch line is a condition of use. TMDB licenses the provider data
 * from JustWatch and asks each app that shows it to say so.
 */
export function WatchProviders({ providers }: { providers: Providers | null }) {
  const theme = useTheme()

  // Absent, not empty. `lib/api.ts` maps a region with no service to null, so
  // a film nobody carries shows no heading above nothing.
  if (!providers) return null

  const open = () => void Linking.openURL(providers.link)

  return (
    <Motion.View
      initial={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
      style={styles.section}
    >
      <Typography variant="titleMediumEmphasized">Where to watch</Typography>

      {GROUPS.map(({ key, label }) =>
        providers[key].length ? (
          <View key={key} style={styles.group}>
            <Typography variant="labelMedium" color={theme.colors.onSurfaceVariant}>
              {label}
            </Typography>
            <View style={styles.tiles}>
              {providers[key].map((provider) => (
                <ProviderTile
                  key={provider.id}
                  provider={provider}
                  label={label}
                  onPress={open}
                />
              ))}
            </View>
          </View>
        ) : null,
      )}

      <Typography variant="labelSmall" color={theme.colors.onSurfaceVariant}>
        Data from JustWatch
      </Typography>
    </Motion.View>
  )
}

function ProviderTile({
  provider,
  label,
  onPress,
}: {
  provider: WatchProvider
  label: string
  onPress: () => void
}) {
  const theme = useTheme()
  const uri = logoUrl(provider.logo_path)

  return (
    <Pressable
      accessibilityRole="link"
      // The label carries the group as well as the name, because the tiles
      // carry no text and a screen reader that read only the name would drop
      // whether the service streams the film or sells it.
      accessibilityLabel={`${provider.name}. ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.colors.surfaceVariant, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {uri ? (
        <RemoteImage
          testID="provider-logo"
          uri={uri}
          recyclingKey={String(provider.id)}
          style={styles.logo}
        />
      ) : (
        <Typography
          variant="labelSmall"
          color={theme.colors.onSurfaceVariant}
          numberOfLines={2}
          style={styles.fallback}
        >
          {provider.name}
        </Typography>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  group: { gap: 6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: TILE, height: TILE },
  fallback: { textAlign: 'center', paddingHorizontal: 2 },
})
