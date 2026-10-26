import { AppBar } from '@rootnative/components/appbar'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { PageHead } from '@rootnative/seo/expo-router'
import { Link, useRouter, type Href } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { metadataFor, privacyMeta } from '../../lib/head'
import { NEW_TAB } from '../../lib/share'

export const generateMetadata = () => metadataFor(privacyMeta)

/** The widest the text runs, the same measure as the about card. */
const MAX_WIDTH = 640

/**
 * The date of the last change to the text below. Google Play reads this page,
 * so a change to what the app sends must change the text and this date
 * together.
 */
const UPDATED = '20 October 2026'

type Source = { label: string; url: Href }

/** A string is a paragraph. An array of strings is a bulleted list. */
type Block = string | string[]

type Part = { title: string; body: Block[]; sources?: Source[] }

const INTRO =
  'This policy tells you which data Reelist uses, where that data goes, and how you can delete it. It applies to the Android app, the iOS app, and the web version.'

const PARTS: Part[] = [
  {
    title: 'In short',
    body: [
      [
        'Reelist has no accounts. You do not sign in.',
        'Reelist shows no ads.',
        'Reelist uses no analytics and no crash reporting.',
        'Your watchlist and your settings stay on your device.',
        'Reelist does not sell data, and it does not share data for advertising.',
      ],
    ],
  },
  {
    title: 'Data on your device',
    body: [
      'Reelist keeps these items in the storage of your device. On the web, it keeps them in the storage of your browser:',
      [
        'The films in your watchlist, with the details that the watchlist shows.',
        'Your choice of light, dark, or system appearance.',
        'Your preferred film language.',
        'The country for the streaming services, if you choose one.',
      ],
      'Reelist reads the country from your device settings to show the streaming services for that country. This country does not leave your device.',
      'To delete these items, clear the watchlist in the app, or uninstall the app. On the web, clear the site data in your browser.',
    ],
  },
  {
    title: 'The Reelist server',
    body: [
      'Reelist gets film data through a small server on Vercel. The server sends each request to TMDB and returns the answer.',
      'A request contains only what the screen needs: for example a film number, your search text, or a language filter. It contains no name and no account.',
      'To stop misuse, the server counts the requests from each IP address. Upstash Redis keeps this count for about two minutes, and then deletes it.',
      'The server keeps a copy of each answer for up to about one hour, so that the same request is faster the next time. The copy contains film data only.',
      'Vercel can keep request logs, with IP addresses, for a short time. The Vercel privacy policy applies to these logs.',
    ],
    sources: [
      { label: 'Vercel privacy policy', url: 'https://vercel.com/legal/privacy-policy' },
    ],
  },
  {
    title: 'TMDB',
    body: [
      'The film data and the images come from TMDB, The Movie Database. Your device loads the posters and the photos directly from TMDB, so TMDB receives your IP address.',
    ],
    sources: [
      { label: 'TMDB privacy policy', url: 'https://www.themoviedb.org/privacy-policy' },
    ],
  },
  {
    title: 'YouTube',
    body: [
      'Reelist plays trailers and other film videos in a YouTube player. Reelist loads YouTube only when you open a video. YouTube and Google can then collect data, as the Google privacy policy tells.',
    ],
    sources: [
      { label: 'Google privacy policy', url: 'https://policies.google.com/privacy' },
    ],
  },
  {
    title: 'App updates',
    body: [
      'Each time the Android app or the iOS app starts, it asks the Expo update service for a new version.',
      'This request contains your IP address, the platform, the app version, and a random number for the installation. The number does not identify you.',
      'The web version does not send this request.',
    ],
    sources: [{ label: 'Expo privacy policy', url: 'https://expo.dev/privacy' }],
  },
  {
    title: 'The web version',
    body: [
      'GitHub Pages hosts the web version. GitHub receives your IP address when your browser loads a page.',
    ],
    sources: [
      {
        label: 'GitHub privacy statement',
        url: 'https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement',
      },
    ],
  },
  {
    title: 'Links and sharing',
    body: [
      'Some buttons open other sites: a streaming service page on TMDB, a video on YouTube, or the source code on GitHub. The privacy policy of that site applies.',
      'When you share a film, your device shows its own share sheet. Reelist does not see where you send the link.',
    ],
  },
  {
    title: 'Permissions',
    body: [
      'The Android app asks for network access only. Reelist does not use your location, your contacts, your photos, your camera, or your microphone.',
    ],
  },
  {
    title: 'Children',
    body: [
      'Reelist is not made for children under 13. Reelist does not knowingly collect data from children.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: ['If this policy changes, this page shows the new text and a new date.'],
  },
  {
    title: 'Contact',
    body: ['To ask a question about this policy, open an issue on GitHub.'],
    sources: [
      {
        label: 'Reelist issues on GitHub',
        url: 'https://github.com/raajnadar/reelist/issues',
      },
    ],
  },
]

export default function PrivacyScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PageHead {...privacyMeta} />
      <AppBar
        title="Privacy policy"
        insetTop
        canGoBack
        // The Play listing links here, so this screen is often the first entry
        // in the history. `router.back` alone would dead-end.
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.column}>
          <Typography variant="bodySmall" color={theme.colors.onSurfaceVariant}>
            Updated {UPDATED}
          </Typography>
          <Typography variant="bodyLarge" style={styles.intro}>
            {INTRO}
          </Typography>

          {PARTS.map((part) => (
            <View key={part.title} style={styles.part}>
              <Typography variant="titleMedium" level={2}>
                {part.title}
              </Typography>
              {part.body.map((block) =>
                typeof block === 'string' ? (
                  <Typography
                    key={block}
                    variant="bodyMedium"
                    color={theme.colors.onSurfaceVariant}
                    style={styles.para}
                  >
                    {block}
                  </Typography>
                ) : (
                  <View key={block.join()} style={styles.list}>
                    {block.map((item) => (
                      <View key={item} style={styles.item}>
                        <Typography
                          variant="bodyMedium"
                          color={theme.colors.onSurfaceVariant}
                        >
                          {'•'}
                        </Typography>
                        <Typography
                          variant="bodyMedium"
                          color={theme.colors.onSurfaceVariant}
                          style={styles.itemText}
                        >
                          {item}
                        </Typography>
                      </View>
                    ))}
                  </View>
                ),
              )}
              {part.sources?.map((source) => (
                <Link key={source.label} href={source.url} asChild>
                  <Pressable
                    accessibilityRole="link"
                    hrefAttrs={NEW_TAB}
                    style={styles.source}
                  >
                    <Typography variant="labelLarge" color={theme.colors.primary}>
                      {source.label}
                    </Typography>
                  </Pressable>
                </Link>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 8, alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_WIDTH },
  intro: { marginTop: 12 },
  part: { marginTop: 28 },
  para: { marginTop: 10 },
  list: { marginTop: 10, gap: 6 },
  item: { flexDirection: 'row', gap: 8 },
  itemText: { flex: 1 },
  source: { alignSelf: 'flex-start', paddingVertical: 8, marginTop: 4 },
})
