import { Image, type ImageStyle } from 'expo-image'
import { useTheme } from '@rootnative/core'
import type { StyleProp } from 'react-native'

/**
 * How long the picture takes to cross-dissolve in, in milliseconds.
 *
 * Short enough that it reads as the image arriving rather than as an effect. A
 * poster from the memory cache resolves inside one frame and never plays it at
 * all, so the dissolve only ever covers a real wait.
 */
const FADE_MS = 220

type Props = {
  /** The TMDB URL. A film with no artwork draws its own fallback instead. */
  uri: string
  /**
   * Resets the view when a recycled row is handed a different film.
   *
   * Every row here is a FlatList, which reuses the host view behind a card as
   * it scrolls. Without this the recycled view keeps the previous poster on
   * screen until the new one finishes downloading, so a fast scroll shows the
   * wrong film under the right title.
   */
  recyclingKey: string
  /** `high` for the one picture a screen is built around. */
  priority?: 'low' | 'normal' | 'high'
  style?: StyleProp<ImageStyle>
  testID?: string
}

/**
 * Every remote picture in the app: the posters, the cast photos, the backdrop.
 *
 * `expo-image` rather than the React Native `Image`, for three things the built
 * in one does not do. It cross-dissolves instead of appearing at full opacity
 * on the frame the bytes land. It keeps decoded images in memory, so a poster
 * that appears in a row, again in the search grid, and again on the detail
 * screen is decoded once rather than three times. And `recyclingKey` blanks a
 * recycled row, which is the bug above.
 *
 * There is no `placeholder`: a blurhash has to be computed from the image, and
 * TMDB sends none. The surface colour under the picture does that job — an
 * unloaded box is a filled shape rather than a hole in the layout.
 */
export function RemoteImage({
  uri,
  recyclingKey,
  priority = 'normal',
  style,
  testID,
}: Props) {
  const theme = useTheme()

  return (
    <Image
      testID={testID}
      source={{ uri }}
      // The caller's style comes second, so a call site can still set its own
      // background — the detail poster does, to match the hairline around it.
      style={[{ backgroundColor: theme.colors.surfaceVariant }, style]}
      contentFit="cover"
      transition={FADE_MS}
      // The default is `disk`, which reaches the file again and decodes it
      // again on every appearance. These are the same few hundred posters for
      // the whole session.
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey}
      priority={priority}
    />
  )
}
