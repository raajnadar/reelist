import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { PageHead } from '@rootnative/seo/expo-router'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DetailHeader, HEADER_HEIGHT } from '../../../components/DetailHeader'
import { DetailHero } from '../../../components/DetailHero'
import { MovieCard } from '../../../components/MovieCard'
import { Skeleton } from '@rootnative/components/skeleton'
import { SkeletonGrid } from '../../../components/Skeleton'
import { StateMessage } from '../../../components/StateMessage'
import { getCollection } from '../../../lib/api'
import { missingFailure, type Failure, type FailureKind } from '../../../lib/errors'
import { filmCount } from '../../../lib/format'
import { GRID_GAP, gridInset, posterColumns } from '../../../lib/grid'
import { useBarScroll } from '../../../lib/floatingBar'
import { collectionMeta, metadataFor, noindexMeta } from '../../../lib/head'
import { BACKDROP_W780, backdropUrl } from '../../../lib/images'
import type { Collection } from '../../../lib/types'
import { useContentWidth } from '../../../lib/useContentWidth'
import { useResource } from '../../../lib/useResource'

export const generateMetadata = () => metadataFor(noindexMeta(REPORTS.missing.title))

/**
 * The backdrop height, as a fraction of the content width. Shorter than the
 * film hero: the page is a grid, and the picture is its heading, not its
 * subject.
 */
const HERO_ASPECT = 0.42

/** The tallest the backdrop grows on a wide window. */
const HERO_MAX_HEIGHT = 320

/**
 * How each kind of failure is presented, and what it offers.
 *
 * The three never share an action, for the reason the film screen gives: a
 * dropped request retries, a setup mistake has no request to repeat, and a
 * link that names no collection leaves only the way out.
 */
const REPORTS: Record<
  FailureKind,
  {
    icon: string
    tone: 'error' | 'neutral'
    title: string
    actionLabel?: string
    actionIcon?: string
  }
> = {
  transient: {
    icon: 'cloud-off-outline',
    tone: 'error',
    title: 'Could not load the collection',
    actionLabel: 'Try again',
    actionIcon: 'refresh',
  },
  setup: { icon: 'cog-outline', tone: 'neutral', title: 'Setup needed' },
  missing: {
    icon: 'link-off',
    tone: 'error',
    title: 'Collection not found',
    actionLabel: 'Go home',
    actionIcon: 'home-outline',
  },
}

/**
 * One franchise: its backdrop, its name, its synopsis, and every film in it
 * as a grid in release order.
 */
export default function CollectionScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const width = useContentWidth()
  const columns = posterColumns(width)

  const { id } = useLocalSearchParams<{ id: string }>()
  // Derived from the param rather than stored, because a bad id needs no
  // request and no loading state.
  const collectionId = Number(id)
  const validId = Number.isInteger(collectionId) && collectionId > 0

  const detail = useResource<Collection | null>(
    validId ? `collection:${collectionId}` : null,
    () => getCollection(collectionId),
    'Could not load the collection',
  )

  const collection = detail.data
  const loading = detail.loading

  const failure: Failure | null = !validId
    ? missingFailure('That link does not point at a collection.')
    : (detail.failure ??
      (!loading && collection === null
        ? missingFailure('TMDB has no collection with that id.')
        : null))

  const { scrollY, onScroll } = useBarScroll()
  const headerSpace = insets.top + HEADER_HEIGHT
  const heroHeight = Math.min(width * HERO_ASPECT, HERO_MAX_HEIGHT)

  const actions: Record<FailureKind, (() => void) | undefined> = {
    transient: detail.reload,
    setup: undefined,
    missing: () => router.replace('/'),
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {failure?.kind === 'missing' ? (
        <PageHead title={REPORTS.missing.title} noindex />
      ) : collection ? (
        <PageHead {...collectionMeta(collection)} />
      ) : null}
      <DetailHeader
        title={collection?.name ?? ''}
        scrollY={scrollY}
        revealAt={heroHeight}
        // `router.back` alone dead-ends on a deep link, where this screen is
        // the first entry in the history and there is nothing to go back to.
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <Presence>
        {loading ? (
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            <Skeleton height={heroHeight} shape="rectangle" />
            <View style={[styles.intro, { paddingHorizontal: gridInset(width) }]}>
              <Skeleton height={28} width="70%" />
              <Skeleton height={60} />
            </View>
            <SkeletonGrid width={width} />
          </Motion.View>
        ) : failure ? (
          <StateMessage
            key="error"
            testID="collection-error"
            icon={REPORTS[failure.kind].icon}
            tone={REPORTS[failure.kind].tone}
            title={REPORTS[failure.kind].title}
            titleLevel={1}
            body={failure.message}
            actionLabel={REPORTS[failure.kind].actionLabel}
            actionIcon={REPORTS[failure.kind].actionIcon}
            onAction={actions[failure.kind]}
            style={{ paddingTop: headerSpace }}
          />
        ) : collection ? (
          <Motion.View
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.fill}
          >
            {/*
              One list with the hero and the synopsis as its header, for the
              reason the person screen gives: the header scrolls away with the
              films.
            */}
            <Motion.FlatList
              data={collection.parts}
              onScroll={onScroll}
              scrollEventThrottle={16}
              key={columns}
              numColumns={columns}
              keyExtractor={(movie) => String(movie.id)}
              renderItem={({ item, index }) => <MovieCard movie={item} index={index} />}
              columnWrapperStyle={columns > 1 ? styles.column : undefined}
              contentContainerStyle={[
                styles.list,
                {
                  paddingBottom: insets.bottom + 16,
                  paddingHorizontal: gridInset(width),
                },
              ]}
              ListHeaderComponent={
                // The hero spans the full width, so the header undoes the inset
                // of the list around it and puts it back on the text.
                <View style={[styles.header, { marginHorizontal: -gridInset(width) }]}>
                  <DetailHero
                    uri={backdropUrl(collection.backdrop_path)}
                    size={BACKDROP_W780}
                    title={collection.name}
                    height={heroHeight}
                    headerSpace={headerSpace}
                    recyclingKey={`collection-${collection.id}`}
                  />
                  <View style={[styles.intro, { paddingHorizontal: gridInset(width) }]}>
                    {/* On the web this is the page's h1. */}
                    <Typography variant="headlineSmallEmphasized" level={1}>
                      {collection.name}
                    </Typography>
                    <Typography
                      variant="labelLarge"
                      color={theme.colors.onSurfaceVariant}
                    >
                      {filmCount(collection.parts.length)}
                    </Typography>
                    {collection.overview ? (
                      <Typography variant="bodyMedium">{collection.overview}</Typography>
                    ) : null}
                  </View>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          </Motion.View>
        ) : null}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  list: { gap: GRID_GAP },
  column: { gap: GRID_GAP },
  header: { marginBottom: 4 },
  intro: { paddingTop: 16, paddingBottom: 8, gap: 8 },
})
