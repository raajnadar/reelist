import { Image, type ImageStyle } from 'expo-image'
import { useTheme } from '@rootnative/core'
import { Picture } from '@rootnative/seo/expo-image'
import { Platform, type StyleProp } from 'react-native'
import type { ImageSize } from '../lib/images'

/**
 * How long the picture takes to cross-dissolve in, in milliseconds.
 *
 * Short enough that it reads as the image arriving rather than as an effect. A
 * poster from the memory cache resolves inside one frame and never plays it at
 * all, so the dissolve only ever covers a real wait.
 */
const FADE_MS = 220

/**
 * The web `<img>` behaves as a View only with these. The browser reads the
 * `width` and `height` attributes as a CSS size, so without `auto` here an
 * `<img>` with `flex: 1` does not stretch, and an `aspectRatio` does nothing
 * because both sides are set. The call site's own `width` still wins.
 *
 * The rest are the defaults that react-native-web gives every View. Without
 * `minHeight: 0`, a `flex: 1` picture keeps the height its ratio gives,
 * overflows a shorter frame, and shows the top of the picture instead of the
 * centre. Without `borderStyle`, a border width draws no border. Without
 * `flexShrink: 0`, a row can squeeze it.
 *
 * The cast is for `borderStyle`: CSS takes it on an image, and the React
 * Native image type does not list it.
 *
 * A workaround for a `@rootnative/seo` defect (DX item R17). Remove it when
 * `Picture` sets this base itself.
 */
const WEB_BOX = {
  width: 'auto',
  height: 'auto',
  boxSizing: 'border-box',
  borderStyle: 'solid',
  borderWidth: 0,
  flexShrink: 0,
  minHeight: 0,
  minWidth: 0,
} as ImageStyle

type Props = {
  /** The TMDB URL. A film with no artwork draws its own fallback instead. */
  uri: string
  /**
   * What the picture shows, for a screen reader and for the `alt` attribute
   * on the web. A crawler indexes an image by this text.
   */
  alt: string
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
  /**
   * The pixel size of the file. With it, the web draws a plain `<img>` in
   * place of expo-image, and the static export holds that tag: a crawler sees
   * the picture and its `alt`, and the browser starts the download before the
   * script runs. Give it to the pictures of the pages the export writes.
   * Native ignores it.
   */
  size?: ImageSize
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
 *
 * On the web, a picture with a `size` is a plain `<img>` instead, because
 * expo-image mounts its image in an effect and a static page holds none of
 * them. That `<img>` has no cross-dissolve, and it needs no `recyclingKey`:
 * a web list does not recycle its views.
 */
export function RemoteImage({
  uri,
  alt,
  recyclingKey,
  priority = 'normal',
  size,
  style,
  testID,
}: Props) {
  const theme = useTheme()

  if (Platform.OS === 'web' && size) {
    return (
      <Picture
        testID={testID}
        source={uri}
        alt={alt}
        width={size.width}
        height={size.height}
        contentFit="cover"
        loading={priority === 'high' ? 'eager' : 'lazy'}
        style={[WEB_BOX, { backgroundColor: theme.colors.surfaceVariant }, style]}
      />
    )
  }

  return (
    <Image
      testID={testID}
      source={{ uri }}
      // Both props. expo-image writes the web `alt` attribute from
      // `accessibilityLabel`, and native reads the same prop.
      alt={alt}
      accessibilityLabel={alt}
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
