import { Card } from '@rootnative/components/card'
import { Checkbox } from '@rootnative/components/checkbox'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import {
  Motion,
  useInterpolatedStyle,
  useMotionValue,
  type SharedValue,
} from '@rootnative/inertia'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Platform, StyleSheet, View, type AccessibilityActionEvent } from 'react-native'
import { metaLine } from '../lib/format'
import { haptic } from '../lib/haptics'
import { FilmMenu } from './FilmMenu'
import { RemoteImage } from './RemoteImage'
import { cascadeWindow, entranceTransition } from '../lib/motion'
import { POSTER_W342, posterUrl } from '../lib/images'
import type { Movie } from '../lib/types'
import type { KeyDownEvent } from '../lib/useWebKey'

export const CARD_WIDTH = 160

type Props = {
  movie: Movie
  index?: number
  /**
   * The parent row's 0-1 in-view sweep, when the row drives the entrance.
   *
   * A horizontal row sets this so its cards animate on arrival rather than at
   * mount — see cascadeWindow. The vertical grids on search and genre leave it
   * unset on purpose: their FlatList already mounts a card as it nears the
   * screen, so the mount stagger fires at the right moment on its own.
   */
  progress?: SharedValue<number>
  /**
   * Closes the sheet the card is on before the film opens, for a card in the
   * search sheet. A plain link from a sheet in the root stack puts the film
   * above the sheet, in a second copy of the `(main)` group with a second
   * navigation. See app/_layout.tsx. The screens the menu opens obey it too.
   */
  dismissTo?: boolean
  /**
   * Turns the card into a checkbox, for the watchlist's select mode. A press
   * then picks the film and does not open it.
   */
  selection?: { selected: boolean; onToggle: () => void }
}

export function MovieCard({ movie, index = 0, progress, dismissTo, selection }: Props) {
  const theme = useTheme()
  const uri = posterUrl(movie.poster_path)

  /*
    Spread, not passed as `undefined` on the link path: `Link asChild` merges
    its own props into the Card, and a prop the Card sets, even to
    `undefined`, replaces the link's `role`.
  */
  const checkboxProps = selection
    ? {
        onPress: selection.onToggle,
        role: 'checkbox' as const,
        'aria-checked': selection.selected,
        /*
          Space is the key of a checkbox, and react-native-web presses an
          element on Space only when its role is `button`. Enter still goes
          through the press. Native sends no key events. The first press of a
          held key counts once.
        */
        onKeyDown: (event: KeyDownEvent) => {
          if (event.nativeEvent.key !== ' ' || event.nativeEvent.repeat) return
          // Without this the page scrolls.
          event.preventDefault?.()
          selection.onToggle()
        },
      }
    : {}

  /*
    The menu of a long press, on Android only. On the web, a held mouse button
    would open it, and the click would then open the film too. On iOS the
    search is a native modal, which draws over the portal the menu uses; iOS
    is to get the native `Link.Preview` instead.

    Null until the first long press, so a list of cards mounts no menus. The
    menu then stays mounted, so its exit animation can run.
  */
  const [menu, setMenu] = useState<boolean | null>(null)
  const openMenu = () => {
    haptic('menu')
    setMenu(true)
  }
  const longPressProps =
    Platform.OS === 'android'
      ? {
          onLongPress: openMenu,
          // TalkBack offers a long press only when the view declares it.
          accessibilityActions: [{ name: 'longpress', label: 'Show film options' }],
          onAccessibilityAction: (event: AccessibilityActionEvent) => {
            if (event.nativeEvent.actionName === 'longpress') openMenu()
          },
        }
      : {}

  // Runs on both paths because a hook cannot be conditional. A resting 1 sits
  // at the end of the card's window, so the style is inert without a row.
  const resting = useMotionValue(1)
  const entrance = useInterpolatedStyle(
    progress ?? resting,
    { opacity: [0, 1], translateY: [24, 0] },
    { inputRange: cascadeWindow(index) },
  )

  const card = (
    <Card
      variant="filled"
      style={styles.card}
      accessibilityLabel={`${movie.title}. ${metaLine(movie.vote_average, movie.release_date)}`}
      {...checkboxProps}
    >
      {/* 2:3 is the TMDB poster ratio.

          The image needs its own size. A remote picture has no measurable
          size until it loads, so one with no dimensions lays out at zero
          height and the poster never appears, whatever the parent sets. The
          fallback View below is fine with `flex: 1`, because a View has no
          intrinsic size to wait for. */}
      <Card.Media aspectRatio={2 / 3}>
        {uri ? (
          <RemoteImage
            testID="movie-poster"
            uri={uri}
            alt={movie.title}
            // The row recycles this view as it scrolls. See RemoteImage.
            recyclingKey={String(movie.id)}
            size={POSTER_W342}
            style={styles.poster}
          />
        ) : (
          <View
            style={[styles.fallback, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <Typography variant="labelSmall" color={theme.colors.onSurfaceVariant}>
              No poster
            </Typography>
          </View>
        )}
        {selection ? (
          /*
            The checkbox only shows the state. The Card carries the press and
            the `checkbox` role, so a screen reader reads one control. The disc
            keeps the empty box visible on a dark poster.
          */
          <View style={styles.check}>
            <View style={[styles.checkDisc, { backgroundColor: theme.colors.surface }]} />
            <Checkbox value={selection.selected} />
          </View>
        ) : null}
      </Card.Media>

      <Card.Content>
        {/* The title box is always two lines tall, even when the title needs
            one. numberOfLines caps the text but reserves no space, so without
            a fixed height a short title makes a shorter card, and a horizontal
            row of cards ends up ragged along the bottom. The height comes from
            the theme, so a change to the type scale keeps the two lines. */}
        <Typography
          variant="labelLargeEmphasized"
          numberOfLines={2}
          style={{ height: theme.typography.labelLargeEmphasized.lineHeight * 2 }}
        >
          {movie.title}
        </Typography>
        <Typography variant="labelSmall" color={theme.colors.onSurfaceVariant}>
          {metaLine(movie.vote_average, movie.release_date)}
        </Typography>
      </Card.Content>
    </Card>
  )

  return (
    /*
      Two nested elements, for the reason CarouselCard spells out: the entrance
      and the gesture layer both write `transform`, so one element cannot hold
      both. The outer owns the entrance, the inner owns the touch response.

      On the row path the outer carries the interpolated style and the inner
      declares no entrance at all. On the standalone path the outer is an inert
      pass-through and the inner keeps the original mount stagger.
    */
    <Motion.View style={progress ? [styles.slot, entrance] : styles.slot}>
      {/*
        The Motion.View wraps the Card rather than replacing it: Card owns the
        M3 surface (elevation, shape, state layer), and this owns the movement.
        Animating the wrapper also keeps the transform off the Card's own press
        handling.
      */}
      <Motion.View
        // Rise and fade in, staggered by position in the row.
        initial={progress ? undefined : { opacity: 0, translateY: 24 }}
        animate={progress ? undefined : { opacity: 1, translateY: 0 }}
        // `hovered` is a no-op on native and drives the web pointer state; the
        // one declaration covers both platforms.
        gesture={{
          hovered: { scale: 1.04, translateY: -6 },
          pressed: { scale: 0.96 },
        }}
        // The stagger delay stays on the entrance keys; on the gesture layers it
        // would delay the answer to a tap.
        transition={
          progress
            ? // A press answers fast; a hover eases. See lib/motion.ts.
              { pressed: 'press', hovered: 'hover' }
            : { ...entranceTransition(index), pressed: 'press', hovered: 'hover' }
        }
      >
        {/*
          A link, not a press handler, so the web renders an anchor: a crawler
          can follow it, and a reader can open it in a new tab. `asChild` puts
          the href and the handler on the Card, which forwards both. In select
          mode the card opens nothing, so it has no link.
        */}
        {selection ? (
          card
        ) : (
          <Link
            href={`/movie/${movie.id}`}
            dismissTo={dismissTo}
            {...longPressProps}
            asChild
          >
            {card}
          </Link>
        )}
      </Motion.View>
      {/* Beside the inner layer, so the press scale does not move the menu. */}
      {menu === null ? null : (
        <FilmMenu
          movie={movie}
          visible={menu}
          onDismiss={() => setMenu(false)}
          dismissTo={dismissTo}
        />
      )}
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  // The animated wrapper carries the width so the hover lift scales the whole
  // card. The Card keeps its own width for the case where it renders alone.
  slot: { width: CARD_WIDTH },
  card: { width: CARD_WIDTH },
  // Matches CarouselCard.poster and the detail screen backdrop: the image
  // carries its own ratio rather than inheriting one from the slot.
  poster: { width: '100%', aspectRatio: 2 / 3 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Card.Media stretches each child over the poster. A width and a height win
  // over that stretch. 48 is the square the checkbox draws in.
  check: { top: 4, left: 4, width: 48, height: 48, pointerEvents: 'none' },
  checkDisc: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
})
