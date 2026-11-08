import { AppBar } from '@rootnative/components/appbar'
import { Icon } from '@rootnative/components/icon'
import { List, ListItem } from '@rootnative/components/list'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { PageHead } from '@rootnative/seo/expo-router'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBarScroll } from '../../lib/floatingBar'
import { metadataFor, noindexMeta } from '../../lib/head'
import { markTipsSeen, TIPS } from '../../lib/tips'

const meta = noindexMeta('Tips and gestures')

export const generateMetadata = () => metadataFor(meta)

/** The widest the text runs, the same measure as the about card. */
const MAX_WIDTH = 640

const INTRO =
  Platform.OS === 'web'
    ? 'Reelist has these shortcuts for the keyboard and the mouse.'
    : 'Some features of Reelist have no button. These gestures open them.'

export default function TipsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { onScroll } = useBarScroll()

  // The reader now knows where the tips are, so the home card and the badge go.
  useEffect(markTipsSeen, [])

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PageHead {...meta} />
      <AppBar
        title="Tips and gestures"
        insetTop
        canGoBack
        onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <Motion.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.column}>
          <Typography
            variant="bodyMedium"
            color={theme.colors.onSurfaceVariant}
            style={styles.intro}
          >
            {INTRO}
          </Typography>
          <List>
            {TIPS.map((tip) => (
              <ListItem
                key={tip.id}
                headlineText={tip.title}
                supportingText={tip.body}
                supportingTextNumberOfLines={0}
                leadingContent={
                  <Icon
                    source={tip.icon}
                    size={24}
                    color={theme.colors.onSurfaceVariant}
                  />
                }
                testID={`tip-${tip.id}`}
              />
            ))}
          </List>
        </View>
      </Motion.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingTop: 8, alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_WIDTH },
  // The list items pad their text by 16, so the intro lines up with them.
  intro: { paddingHorizontal: 16, marginBottom: 8 },
})
