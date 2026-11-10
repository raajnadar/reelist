import { Button } from '@rootnative/components/button'
import { Card } from '@rootnative/components/card'
import { Icon } from '@rootnative/components/icon'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { BUTTON_SIZE } from '../lib/buttonSize'
import { markTipsSeen, TIPS, type Tip } from '../lib/tips'
import { TooltipIconButton } from './TooltipIconButton'

/** The widest the card grows beside a rail, the same measure as the about card. */
const MAX_WIDTH = 640

/**
 * The tips one at a time, above the film rows of the home screen, until the
 * reader closes the card or reaches the last tip. One tip keeps the card
 * small, so the carousel stays in view under it.
 */
export function TipsCard({ tips = TIPS }: { tips?: Tip[] }) {
  const theme = useTheme()
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [heights, setHeights] = useState<Record<string, number>>({})

  const tip = tips[index]
  if (!tip) return null
  const last = index === tips.length - 1
  const tallest = Math.max(0, ...Object.values(heights))

  const measure = (id: string) => (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setHeights((current) =>
      current[id] === height ? current : { ...current, [id]: height },
    )
  }

  return (
    <Card variant="filled" style={styles.card} testID="tips-card">
      <Card.Content>
        <View style={styles.head}>
          <Typography variant="labelLarge" color={theme.colors.primary}>
            {`Tip ${index + 1} of ${tips.length}`}
          </Typography>
          <TooltipIconButton
            icon="close"
            variant="standard"
            accessibilityLabel="Close the tips"
            onPress={markTipsSeen}
            anchorStyle={styles.close}
          />
        </View>
        {/*
          Every tip is also laid out unseen, so the card keeps the height of
          the longest one. Without this, the rows under the card moved on each
          press of "Next".
        */}
        <View style={{ minHeight: tallest }}>
          {tips.map((item) => (
            <View
              key={item.id}
              onLayout={measure(item.id)}
              style={styles.measure}
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <TipBody tip={item} />
            </View>
          ))}
          {/* A screen reader reads the new tip after a press on "Next". */}
          <Motion.View
            key={tip.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition="enter"
            accessibilityLiveRegion="polite"
          >
            <TipBody tip={tip} />
          </Motion.View>
        </View>
      </Card.Content>
      <Card.Actions>
        <Button
          variant="text"
          size={BUTTON_SIZE.inline}
          onPress={() => router.push('/tips')}
        >
          All tips
        </Button>
        <Button
          variant="tonal"
          size={BUTTON_SIZE.inline}
          onPress={last ? markTipsSeen : () => setIndex(index + 1)}
        >
          {last ? 'Got it' : 'Next'}
        </Button>
      </Card.Actions>
    </Card>
  )
}

function TipBody({ tip }: { tip: Tip }) {
  const theme = useTheme()

  return (
    <View style={styles.tip}>
      <Icon source={tip.icon} size={24} color={theme.colors.onSurfaceVariant} />
      <View style={styles.text}>
        <Typography variant="titleMedium">{tip.title}</Typography>
        <Typography variant="bodyMedium" color={theme.colors.onSurfaceVariant}>
          {tip.body}
        </Typography>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  card: { marginHorizontal: 16, marginTop: 8, marginBottom: 8, maxWidth: MAX_WIDTH },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Puts the button in the corner, where the padding of the card would push it in.
  close: { marginTop: -8, marginEnd: -8 },
  tip: { flexDirection: 'row', gap: 16, marginTop: 4 },
  text: { flex: 1, gap: 4 },
})
