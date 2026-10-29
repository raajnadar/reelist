import { AppBar } from '@rootnative/components/appbar'
import { Divider } from '@rootnative/components/divider'
import { IconButton } from '@rootnative/components/icon-button'
import { Menu } from '@rootnative/components/menu'
import { LinearProgress } from '@rootnative/components/progress'
import { useSnackbar } from '@rootnative/components/snackbar'
import { Tabs } from '@rootnative/components/tabs'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion, Presence } from '@rootnative/inertia'
import { useIsFocused, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { BackHandler, FlatList, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MovieCard } from '../../components/MovieCard'
import { SkeletonGrid } from '../../components/Skeleton'
import { StateMessage } from '../../components/StateMessage'
import { NoindexHead } from '../../components/NoindexHead'
import { filmCount } from '../../lib/format'
import { metadataFor, noindexMeta } from '../../lib/head'
import { haptic } from '../../lib/haptics'
import { GRID_GAP, gridInset, posterColumns } from '../../lib/grid'
import { useContentWidth } from '../../lib/useContentWidth'
import { useSearchLaunch } from '../../lib/useSearchLaunch'
import {
  clearWatchlist,
  isWatched,
  removeSaved,
  restoreSaved,
  setWatched,
  sortWatchlist,
  useWatchlist,
  type WatchlistOrder,
} from '../../lib/watchlist'

export const generateMetadata = () => metadataFor(noindexMeta('Watchlist'))

const ORDERS: { value: WatchlistOrder; label: string; icon: string }[] = [
  { value: 'added', label: 'Date added', icon: 'calendar-clock-outline' },
  { value: 'title', label: 'Title', icon: 'sort-alphabetical-ascending' },
  { value: 'rating', label: 'Rating', icon: 'star-outline' },
]

type Tab = 'toWatch' | 'watched'

const TABS: { value: Tab; label: string }[] = [
  { value: 'toWatch', label: 'To watch' },
  { value: 'watched', label: 'Watched' },
]

/**
 * Below this content width the two tabs share the row. Above it each tab
 * keeps its own width, in line with the grid: two tabs that each span half of
 * a desktop window read as two bars, not as tabs.
 */
const SPLIT_TABS_MAX_WIDTH = 600

export default function WatchlistScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const width = useContentWidth()
  const columns = posterColumns(width)
  const inset = gridInset(width)

  /**
   * The saved films come from the device, not from TMDB.
   *
   * This screen makes no request and has no failure state for that reason: a
   * saved film carries the fields its card draws, so the grid needs nothing
   * from the network. The only wait is the read, and `loaded` is what the
   * placeholders below stand in for.
   */
  const { movies, loaded } = useWatchlist()

  const snackbar = useSnackbar()
  const { ref: searchRef, open: openSearch } = useSearchLaunch()
  const [order, setOrder] = useState<WatchlistOrder>('added')
  const [tab, setTab] = useState<Tab>('toWatch')

  /**
   * The ids the reader picked, or null outside select mode. One state for
   * both, so select mode cannot be on with no set, or off with an old one.
   */
  const [picks, setPicks] = useState<ReadonlySet<number> | null>(null)

  const watchedCount = useMemo(() => movies.filter(isWatched).length, [movies])
  const shown = useMemo(
    () =>
      sortWatchlist(
        movies.filter((m) => isWatched(m) === (tab === 'watched')),
        order,
      ),
    [movies, tab, order],
  )

  /*
    The picks are read against the films on the tab. A film that leaves the
    tab while it is picked, for example one unsaved on its own page, drops out
    of the count and out of the action. Select mode ends when the tab has no
    film left.
  */
  const selecting = picks !== null && shown.length > 0
  const picked = picks ? shown.filter((m) => picks.has(m.id)) : []
  const allPicked = picked.length === shown.length
  const stopSelecting = () => setPicks(null)

  /**
   * Back on Android and Escape on the web end select mode, not the screen.
   * Only while this screen is on top: it stays mounted under the search
   * sheet, and the listener would then take the back press of the sheet.
   */
  const focused = useIsFocused()
  useEffect(() => {
    if (!selecting || !focused) return
    if (Platform.OS === 'web') {
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setPicks(null)
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setPicks(null)
      return true
    })
    return () => subscription.remove()
  }, [selecting, focused])

  const changeTab = (value: string) => {
    const next = TABS.find((t) => t.value === value)
    if (!next) return
    setTab(next.value)
    // A pick belongs to the tab it was made on.
    setPicks(null)
  }

  const togglePick = (id: number) => {
    haptic('select')
    setPicks((prev) => {
      if (!prev) return prev
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  const toggleAll = () =>
    setPicks(allPicked ? new Set() : new Set(shown.map((m) => m.id)))

  const markPicked = () => {
    const watched = tab === 'toWatch'
    const changed = setWatched(
      picked.map((m) => m.id),
      watched,
    )
    const state = watched ? 'watched' : 'not watched'
    stopSelecting()
    haptic(watched ? 'save' : 'unsave')
    snackbar.show({
      message: `${filmCount(changed.length)} marked as ${state}`,
      actionLabel: 'Undo',
      duration: 'long',
      replace: true,
      onAction: () => {
        setWatched(changed, !watched)
        haptic(watched ? 'unsave' : 'save')
      },
    })
  }

  const removePicked = () => {
    const removed = removeSaved(picked.map((m) => m.id))
    stopSelecting()
    haptic('unsave')
    snackbar.show({
      message: `${filmCount(removed.length)} removed from your watchlist`,
      actionLabel: 'Undo',
      duration: 'long',
      replace: true,
      onAction: () => {
        // Lowest index first, so each film goes back to its old place. See
        // removeSaved.
        for (const { film, at } of removed) restoreSaved([film], at)
        haptic('save')
      },
    })
  }

  /*
    No confirmation dialog: the undo makes the clear safe, and a dialog would
    add a step to every clear to protect against the rare wrong one.
  */
  const clear = () => {
    const removed = clearWatchlist()
    haptic('unsave')
    snackbar.show({
      message: 'Watchlist cleared',
      actionLabel: 'Undo',
      duration: 'long',
      replace: true,
      onAction: () => {
        restoreSaved(removed)
        haptic('save')
      },
    })
  }

  const selectActions = (
    <View style={styles.actions}>
      <IconButton
        icon={allPicked ? 'select-off' : 'select-all'}
        variant="standard"
        accessibilityLabel={allPicked ? 'Select none' : 'Select all'}
        onPress={toggleAll}
      />
      <IconButton
        icon={tab === 'toWatch' ? 'eye-check-outline' : 'eye-off-outline'}
        variant="standard"
        accessibilityLabel={tab === 'toWatch' ? 'Mark as watched' : 'Mark as not watched'}
        disabled={!picked.length}
        onPress={markPicked}
      />
      <IconButton
        icon="delete-outline"
        variant="standard"
        accessibilityLabel="Remove from watchlist"
        disabled={!picked.length}
        onPress={removePicked}
      />
    </View>
  )

  const options = movies.length ? (
    <Menu
      align="end"
      anchor={
        <IconButton
          icon="dots-vertical"
          variant="standard"
          accessibilityLabel="Watchlist options"
          testID="watchlist-options"
        />
      }
    >
      {shown.length ? (
        <>
          <Menu.Item
            label="Select films"
            leadingIcon="checkbox-multiple-marked-outline"
            onPress={() => setPicks(new Set())}
          />
          <Divider />
        </>
      ) : null}
      {ORDERS.map((o) => (
        <Menu.Item
          key={o.value}
          label={o.label}
          leadingIcon={o.icon}
          trailingIcon={order === o.value ? 'check' : undefined}
          onPress={() => setOrder(o.value)}
        />
      ))}
      <Divider />
      <Menu.Item
        label="Clear watchlist"
        leadingIcon="delete-sweep-outline"
        contentColor={theme.colors.error}
        onPress={clear}
      />
    </Menu>
  ) : undefined

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <NoindexHead title="Watchlist" />
      <AppBar
        title={
          selecting
            ? picked.length
              ? `${picked.length} selected`
              : 'Select films'
            : 'Watchlist'
        }
        insetTop
        leading={
          selecting ? (
            <IconButton
              icon="close"
              variant="standard"
              accessibilityLabel="Stop selecting"
              onPress={stopSelecting}
            />
          ) : undefined
        }
        canGoBack
        // Matches search, genre, and detail: `router.back` alone dead-ends when
        // this screen is the first entry in the history, as it is on a deep
        // link.
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        trailing={selecting ? selectActions : options}
      />

      <Presence>
        {!loaded ? (
          /*
            The device read is fast, and on a cold start it is not instant. The
            placeholders are here so a reader with a full watchlist never sees
            "Nothing saved yet" for a frame before their films arrive.
          */
          <Motion.View key="loading" exit={{ opacity: 0 }} transition="exit">
            <SkeletonGrid width={width} />
          </Motion.View>
        ) : movies.length ? (
          <Motion.View
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.fill}
          >
            <Tabs
              // A new inset moves each tab without a change of size. On the web
              // a tab measures itself only on a change of size, so the indicator
              // stayed at the old place, 48 left of the label at 1440. The key
              // mounts the row again, and each tab measures again.
              key={inset}
              items={TABS}
              value={tab}
              onValueChange={changeTab}
              scrollable={width > SPLIT_TABS_MAX_WIDTH}
              edgePadding={inset}
              testID="watchlist-tabs"
            />
            <View style={[styles.progress, { paddingHorizontal: inset }]}>
              <Typography variant="labelLarge" color={theme.colors.onSurfaceVariant}>
                {`${watchedCount} of ${filmCount(movies.length)} watched`}
              </Typography>
              <LinearProgress
                progress={watchedCount / movies.length}
                accessibilityLabel="Films watched"
              />
            </View>

            {shown.length ? (
              <FlatList
                data={shown}
                // `key` forces a remount when the column count changes. FlatList
                // caches its layout per item and does not recompute on a
                // numColumns change alone, which leaves the old grid geometry
                // behind after a rotation or a browser resize.
                key={columns}
                numColumns={columns}
                keyExtractor={(m) => String(m.id)}
                // A pick changes no film in `data`, so FlatList needs this to
                // draw the checkboxes again.
                extraData={picks}
                renderItem={({ item, index }) => (
                  <MovieCard
                    movie={item}
                    index={index}
                    selection={
                      picks
                        ? {
                            selected: picks.has(item.id),
                            onToggle: () => togglePick(item.id),
                          }
                        : undefined
                    }
                  />
                )}
                columnWrapperStyle={columns > 1 ? styles.column : undefined}
                contentContainerStyle={[
                  styles.list,
                  {
                    paddingHorizontal: inset,
                    paddingBottom: insets.bottom + 16,
                  },
                ]}
                showsVerticalScrollIndicator={false}
              />
            ) : tab === 'toWatch' ? (
              <StateMessage
                testID="watchlist-all-watched"
                icon="check-all"
                title="All watched"
                body="You watched every film on your list."
                actionLabel="Find a movie"
                actionIcon="magnify"
                actionRef={searchRef}
                onAction={() => void openSearch()}
              />
            ) : (
              <StateMessage
                testID="watchlist-none-watched"
                icon="eye-outline"
                title="Nothing watched yet"
                body="Select the films you saw, and mark them as watched."
                actionLabel="Select films"
                actionIcon="checkbox-multiple-marked-outline"
                onAction={() => {
                  setTab('toWatch')
                  setPicks(new Set())
                }}
              />
            )}
          </Motion.View>
        ) : (
          /*
            Nothing saved. The action opens search rather than the home screen:
            a reader on an empty watchlist has a film in mind, and the AppBar
            already carries the way back.
          */
          <StateMessage
            key="empty"
            testID="watchlist-empty"
            icon="bookmark-outline"
            title="Nothing saved yet"
            body="Open a movie and press Save. The films you keep appear here."
            actionLabel="Find a movie"
            actionIcon="magnify"
            actionRef={searchRef}
            onAction={() => void openSearch()}
          />
        )}
      </Presence>
    </View>
  )
}

const styles = StyleSheet.create({
  // Clipped: the focus ring of an icon button draws 5 past its box, and the
  // bar pads it by 4. In select mode the last action sits in that gutter, so
  // on the web the ring widened the page by a pixel and the browser answered
  // with a sideways scroll.
  screen: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1 },
  actions: { flexDirection: 'row' },
  progress: { gap: 8, paddingTop: 16 },
  /*
    The top inset is inside the scroller, not above it: a vertical scroller
    clips at its own top edge, so a card in the first row that grows under the
    pointer would come back cut off. GRID_GAP is the room it needs — see
    LIFT_SPACE — and it is the same space that separates two rows.
  */
  // The horizontal inset comes from the content width; see gridInset.
  list: { paddingTop: GRID_GAP, gap: GRID_GAP },
  column: { gap: GRID_GAP },
})
