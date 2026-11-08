import { BottomSheet } from '@rootnative/components/bottom-sheet'
import { Button } from '@rootnative/components/button'
import { ButtonGroup } from '@rootnative/components/button-group'
import { Checkbox } from '@rootnative/components/checkbox'
import { Chip } from '@rootnative/components/chip'
import { Divider } from '@rootnative/components/divider'
import { List, ListItem } from '@rootnative/components/list'
import { Slider, type SliderValue } from '@rootnative/components/slider'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { BUTTON_SIZE } from '../lib/buttonSize'
import {
  DECADES,
  EMPTY_FILTERS,
  LANGUAGES,
  RATINGS,
  RUNTIME_LIMIT,
  RUNTIME_STEP,
  SORTS,
  hasFilters,
  orderLanguages,
  runtimeFromBounds,
  runtimeLabel,
  type DiscoverFilters,
} from '../lib/discover'
import { haptic } from '../lib/haptics'

/** The rating slider steps through "Any" and then each floor in `RATINGS`. */
const ratingText = (step: number): string =>
  step === 0 ? 'Any' : RATINGS[step - 1].label

const runtimeText = (minutes: number): string =>
  minutes >= RUNTIME_LIMIT ? 'No limit' : `${minutes} min`

/**
 * Every genre filter and the sort order, in a sheet from the bottom edge.
 *
 * The picks are a draft until "Show films". A grid that reloads under the
 * sheet on each step of a slider sends requests the reader never sees, and a
 * drag down, the scrim, Back, or Escape is then a way out that changes
 * nothing.
 *
 * Each open mounts a new form, so each draft starts from the filters on
 * screen. The unmount at the end of the exit animation is too late: a reader
 * who opens the sheet again while it slides away would get the draft they
 * threw away.
 */
export function FilterSheet({
  visible,
  filters,
  onApply,
  onDismiss,
}: {
  visible: boolean
  filters: DiscoverFilters
  onApply: (filters: DiscoverFilters) => void
  onDismiss: () => void
}) {
  const [opens, setOpens] = useState(0)
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setOpens(opens + 1)
  }

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      style={styles.sheet}
      scrimAccessibilityLabel="Close filters"
      testID="filter-sheet"
    >
      <FilterForm key={opens} filters={filters} onApply={onApply} />
    </BottomSheet>
  )
}

function FilterForm({
  filters,
  onApply,
}: {
  filters: DiscoverFilters
  onApply: (filters: DiscoverFilters) => void
}) {
  const [draft, setDraft] = useState(filters)
  const update = (change: Partial<DiscoverFilters>) =>
    setDraft((current) => ({ ...current, ...change }))

  const ratingStep =
    draft.rating === undefined
      ? 0
      : RATINGS.findIndex((r) => r.value === draft.rating) + 1
  const runtimeBounds: [number, number] = [
    draft.runtime?.min ?? 0,
    draft.runtime?.max ?? RUNTIME_LIMIT,
  ]
  const languages = draft.languages ?? []

  const pickSort = (value: string | null) => {
    const sort = SORTS.find((s) => s.value === value)?.value
    // A press on the order already chosen gives null. An order is never
    // empty, so that press keeps it.
    if (sort === undefined || sort === (draft.sort ?? 'popular')) return
    haptic('select')
    update({ sort: sort === 'popular' ? undefined : sort })
  }

  const pickRating = (value: SliderValue) => {
    if (typeof value !== 'number') return
    const step = Math.round(value)
    update({ rating: step === 0 ? undefined : RATINGS[step - 1]?.value })
  }

  const pickRuntime = (value: SliderValue) => {
    if (typeof value === 'number') return
    update({ runtime: runtimeFromBounds(value) })
  }

  const pickDecade = (decade: number) => {
    haptic('select')
    update({ decade: draft.decade === decade ? undefined : decade })
  }

  const toggleLanguage = (code: string) => {
    haptic('select')
    const next = languages.includes(code)
      ? languages.filter((c) => c !== code)
      : orderLanguages([...languages, code])
    update({ languages: next.length ? next : undefined })
  }

  return (
    <View style={styles.form}>
      <View style={styles.header}>
        <Typography variant="titleLarge" level={2}>
          Filters
        </Typography>
        <Button
          variant="text"
          size={BUTTON_SIZE.inline}
          disabled={!hasFilters(draft)}
          onPress={() => setDraft(EMPTY_FILTERS)}
          testID="filter-clear"
        >
          Clear all
        </Button>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Section title="Sort by">
          <ButtonGroup
            variant="connected"
            selectionMode="single"
            value={draft.sort ?? 'popular'}
            onValueChange={pickSort}
            items={SORTS.map((s) => ({ value: s.value, label: s.label }))}
            accessibilityLabel="Sort by"
          />
        </Section>

        <Section title="Minimum rating" value={ratingText(ratingStep)}>
          <Slider
            value={ratingStep}
            onValueChange={pickRating}
            minimumValue={0}
            maximumValue={RATINGS.length}
            step={1}
            formatValueLabel={ratingText}
            accessibilityLabel="Minimum rating"
            testID="filter-rating-slider"
          />
        </Section>

        <Section title="Runtime" value={runtimeLabel(draft.runtime ?? {})}>
          {/* R49: a screen reader can move only the low thumb of a range
              slider. The fix is in the library; the app has no way around it. */}
          <Slider
            value={runtimeBounds}
            onValueChange={pickRuntime}
            minimumValue={0}
            maximumValue={RUNTIME_LIMIT}
            step={RUNTIME_STEP}
            // Sixteen stops are too close together to read as marks.
            showTickMarks={false}
            formatValueLabel={runtimeText}
            accessibilityLabel="Runtime"
            testID="filter-runtime-slider"
          />
        </Section>

        <Section title="Decade">
          <View style={styles.chips}>
            {DECADES.map((d) => (
              <Chip
                key={d.value}
                variant="filter"
                selected={draft.decade === d.value}
                onPress={() => pickDecade(d.value)}
                testID={`decade-${d.value}`}
              >
                {d.label}
              </Chip>
            ))}
          </View>
        </Section>

        <List headline="Languages" headingLevel={3}>
          {LANGUAGES.map((l) => {
            const checked = languages.includes(l.value)
            return (
              <ListItem
                key={l.value}
                headlineText={l.label}
                leadingContent={<Checkbox value={checked} />}
                onPress={() => toggleLanguage(l.value)}
                role="checkbox"
                aria-checked={checked}
                testID={`language-${l.value}`}
              />
            )
          })}
        </List>
      </ScrollView>

      <Divider />
      <View style={styles.footer}>
        <Button
          size={BUTTON_SIZE.inline}
          onPress={() => onApply(draft)}
          style={styles.apply}
          testID="filter-apply"
        >
          Show films
        </Button>
      </View>
    </View>
  )
}

function Section({
  title,
  value,
  children,
}: {
  title: string
  /** The current pick, beside the title. */
  value?: string
  children: ReactNode
}) {
  const theme = useTheme()
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Typography variant="titleSmall" level={3} color={theme.colors.onSurfaceVariant}>
          {title}
        </Typography>
        {value ? <Typography variant="bodyMedium">{value}</Typography> : null}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  // The sheet grows to its content, up to the window. The language list
  // alone is taller than a phone, so the cap keeps the top of the screen in
  // view, and the content between the title and the button scrolls.
  sheet: { maxHeight: '90%' },
  form: { flexShrink: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingStart: 16,
    paddingEnd: 8,
    paddingBottom: 4,
  },
  scroll: { flexShrink: 1 },
  content: { paddingBottom: 8 },
  section: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  apply: { alignSelf: 'stretch' },
})
