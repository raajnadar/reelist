import { AppBar } from '@rootnative/components/appbar'
import { Button } from '@rootnative/components/button'
import { Chip } from '@rootnative/components/chip'
import { Divider } from '@rootnative/components/divider'
import { IconButton } from '@rootnative/components/icon-button'
import { Typography } from '@rootnative/components/typography'
import componentsPackage from '@rootnative/components/package.json'
import { useBreakpoint, useTheme, type ThemeMode } from '@rootnative/core'
import corePackage from '@rootnative/core/package.json'
import { Motion, Stagger } from '@rootnative/inertia'
import inertiaPackage from '@rootnative/inertia/package.json'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { setMode, useAppearance } from '../lib/appearance'

const DOCS_URL = 'https://rootnative.github.io/ui/'
const SOURCE_URL = 'https://github.com/raajnadar/reelist'

/**
 * The card's width on anything wider than a phone, and the widest the text ever
 * runs inside it.
 *
 * Left unbounded on a desktop monitor a paragraph ran past 1400 px, about three
 * times a readable measure. The same number does both jobs, so the column and
 * the card that holds it can never disagree.
 */
const MAX_WIDTH = 640

/** The tallest the card grows on a wide screen, as a share of the window. */
const MAX_HEIGHT_RATIO = 0.86

/**
 * How dark the area around the card goes.
 *
 * The MD3 `scrim` role is a solid colour — black in every theme — and the spec
 * applies it at 32%. Painted at full strength it does exactly what it looks
 * like it should not: it hides the film screen behind the card, which is the
 * one thing a transparent modal was chosen to keep.
 */
const SCRIM_OPACITY = 0.32

/**
 * The three packages, and the version of each one that is running.
 *
 * The version is read from the package rather than written here. All three
 * publish `./package.json` in their exports, so this is the number actually
 * installed and it cannot fall out of step with a copy in this file.
 */
const PACKAGES: { name: string; version: string; repo: string; role: string }[] = [
  {
    name: '@rootnative/core',
    version: corePackage.version,
    repo: corePackage.homepage,
    role: 'The theme: colour, type, spacing, and corners.',
  },
  {
    name: '@rootnative/components',
    version: componentsPackage.version,
    repo: componentsPackage.homepage,
    role: 'The parts: buttons, cards, chips, dialogs, and more.',
  },
  {
    name: '@rootnative/inertia',
    version: inertiaPackage.version,
    // A different repository from the two above, which is worth showing rather
    // than flattening: the animation layer ships on its own release cycle.
    repo: inertiaPackage.homepage,
    role: 'The movement: every fade, slide, and press.',
  },
]

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/**
 * The settings sheet: the light and dark control first, then what the app is
 * and what draws it, below a rule for the reader who wants it.
 */
export default function AboutScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mode } = useAppearance()

  /**
   * A phone gets the whole window; anything wider gets a card.
   *
   * `useBreakpoint` is the library's own reading of the window size class.
   * Below `medium` a centred card with margins would be a worse full-screen
   * page, so on a phone the card simply fills the space and drops its corner.
   */
  const roomy = useBreakpoint() !== 'compact'
  const { height } = useWindowDimensions()

  /**
   * The card's corner.
   *
   * `cornerNone` rather than a literal 0: a phone's card meets the screen edge
   * on every side, and a rounded corner there would cut a notch out of the
   * page and show the film screen through it.
   */
  const cardRadius = roomy ? theme.shape.cornerExtraLarge : theme.shape.cornerNone

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/'))

  return (
    /*
      The route is a `transparentModal`, so this view is painted over the film
      screen rather than instead of it. Everything the reader sees here — the
      scrim, the card, its corner — is drawn below, which is why the corner can
      come from the theme the card is about to change.
    */
    <View style={styles.layer}>
      {/*
        The scrim. A press on it dismisses, which is what a reader expects of
        the dark area around a dialog, and it is the reason this is a Pressable
        rather than a plain view with a background colour.

        On a phone the card covers it completely, so it is only ever reachable
        where it is also visible.
      */}
      <Pressable
        onPress={dismiss}
        testID="about-scrim"
        // Out of the accessibility tree on purpose. It is a second way to do
        // what the close button already does, so announcing it would give a
        // screen reader two controls with one meaning and no way to tell them
        // apart. Pointer users get the shortcut; everyone keeps the button.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        focusable={false}
        style={[
          styles.scrim,
          { backgroundColor: theme.colors.scrim, opacity: SCRIM_OPACITY },
        ]}
      />

      <Motion.View
        initial={{ opacity: 0, translateY: 16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition="enter"
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.background,
            borderRadius: cardRadius,
          },
          roomy
            ? { width: MAX_WIDTH, maxHeight: Math.round(height * MAX_HEIGHT_RATIO) }
            : styles.cardFull,
        ]}
      >
        {/*
          A close cross rather than `canGoBack`. This is a modal, so the reader
          dismisses it; a back arrow would promise a place to go back to.

          `router.back` alone dead-ends on a deep link straight to /about,
          which the web build allows. The fallback matches search and detail.

          `insetTop` is right in both layouts. The bar measures its own top
          inset, so a card floating clear of the status bar adds nothing, and
          a phone's full-height card gets the gap it needs.
        */}
        <AppBar
          title="About Reelist"
          insetTop
          leading={
            // IconButton pins itself to the top of its parent with
            // `alignSelf: 'flex-start'`, which puts it above the centred title.
            // The frame centres it, as the bar does for its own back button.
            <View style={styles.closeFrame}>
              <IconButton
                icon="close"
                variant="standard"
                accessibilityLabel="Close"
                testID="about-close"
                onPress={dismiss}
              />
            </View>
          }
        />

        <Motion.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        >
          {/*
          The reading column. `alignItems: 'center'` on the content container
          would shrink every child to its own text width, so the centring is
          done by a wrapper that still claims the full width up to the cap.
        */}
          <View style={styles.column}>
            {/*
            One cascade for the whole screen, so the sections arrive in reading
            order instead of together.
          */}
            <Stagger interval={70}>
              <Motion.View
                initial={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition="enter"
                style={styles.modes}
              >
                <Typography variant="titleMedium" style={styles.modesTitle}>
                  Light and dark
                </Typography>
                <View style={styles.chips}>
                  {MODES.map((item) => (
                    <Chip
                      key={item.value}
                      variant="filter"
                      selected={item.value === mode}
                      onPress={() => setMode(item.value)}
                      testID={`mode-${item.value}`}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </View>
                <Typography
                  variant="bodySmall"
                  color={theme.colors.onSurfaceVariant}
                  style={styles.note}
                >
                  The app follows your device setting until you change it here.
                </Typography>
              </Motion.View>

              {/*
                The part for a developer. No heading of its own: the app bar
                already says "About Reelist".
              */}
              <Motion.View
                initial={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition="enter"
                style={styles.aboutHead}
              >
                <Divider style={styles.rule} />
                <Typography variant="bodyMedium" color={theme.colors.onSurfaceVariant}>
                  Reelist is a film browser. Look up a film, watch the trailer, read about
                  the cast, and keep the ones you want to see later. One app runs on
                  iPhone, on Android, and in a web browser.
                </Typography>
                <Typography
                  variant="bodyMedium"
                  color={theme.colors.onSurfaceVariant}
                  style={styles.para}
                >
                  Every button, card, and chip in it is drawn by RootNative UI, a toolkit
                  for React Native apps. It starts with Google’s Material Design 3 and
                  lets you replace it.
                </Typography>
              </Motion.View>

              <Section
                title="Three packages"
                lead="Press a name to open its source."
              >
                {PACKAGES.map((item) => (
                  <View key={item.name} style={styles.package}>
                    <View style={styles.packageHead}>
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`${item.name} on GitHub`}
                        testID={`repo-${item.name}`}
                        onPress={() => void Linking.openURL(item.repo)}
                      >
                        <Typography variant="titleSmall" color={theme.colors.primary}>
                          {item.name}
                        </Typography>
                      </Pressable>
                      <Typography
                        variant="labelSmall"
                        color={theme.colors.onSurfaceVariant}
                      >
                        {item.version}
                      </Typography>
                    </View>
                    <Typography variant="bodySmall" color={theme.colors.onSurfaceVariant}>
                      {item.role}
                    </Typography>
                  </View>
                ))}
              </Section>

              <Section title="Read more">
                <View style={styles.links}>
                  <Button
                    variant="tonal"
                    size="m"
                    leadingIcon="book-open-variant"
                    onPress={() => void Linking.openURL(DOCS_URL)}
                  >
                    RootNative UI documentation
                  </Button>
                  {/*
                  This app, not the library. Everything the page claims is in
                  one small repository, so a reader can go and check it — the
                  same reason each look prints the call that builds it.
                */}
                  <Button
                    variant="outlined"
                    size="m"
                    leadingIcon="github"
                    onPress={() => void Linking.openURL(SOURCE_URL)}
                  >
                    Reelist on GitHub
                  </Button>
                </View>
              </Section>
            </Stagger>
          </View>
        </Motion.ScrollView>
      </Motion.View>
    </View>
  )
}

/**
 * One block of the page: a rule, a heading, an optional lead, and the control.
 *
 * It is a `Motion.View` so that `<Stagger>` in the screen above can give it a
 * slot in the cascade. A plain View would hold the section's content but take
 * no delay of its own, and the whole page would arrive at once.
 */
function Section({
  title,
  lead,
  children,
}: {
  title: string
  lead?: string
  children: ReactNode
}) {
  const theme = useTheme()

  return (
    <Motion.View
      initial={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
      style={styles.section}
    >
      <Divider style={styles.rule} />
      <Typography variant="titleMedium">{title}</Typography>
      {lead ? (
        <Typography
          variant="bodySmall"
          color={theme.colors.onSurfaceVariant}
          style={styles.lead}
        >
          {lead}
        </Typography>
      ) : null}
      {children}
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  // Centres the card over the scrim. The layer itself stays transparent: the
  // navigator already made this route see-through.
  layer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: { overflow: 'hidden' },
  cardFull: { flex: 1, alignSelf: 'stretch' },
  closeFrame: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 8, alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_WIDTH },
  // No rule above it, unlike a section: nothing comes before it on the page.
  modes: { marginTop: 8 },
  modesTitle: { marginBottom: 12 },
  section: { marginTop: 28 },
  aboutHead: { marginTop: 28 },
  rule: { marginBottom: 16 },
  lead: { marginTop: 4, marginBottom: 12 },
  para: { marginTop: 10 },
  note: { marginTop: 10 },
  package: { marginTop: 12, gap: 2 },
  packageHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
