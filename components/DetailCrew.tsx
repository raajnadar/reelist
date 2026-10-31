import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Motion } from '@rootnative/inertia'
import { Link } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import type { CrewMember } from '../lib/types'
import { useServerPainted } from '../lib/useServerPainted'

/**
 * The two groups the block prints, in order. The label takes the plural when
 * the group holds more than one name.
 */
const GROUPS: { role: CrewMember['role']; one: string; many: string }[] = [
  { role: 'director', one: 'Director', many: 'Directors' },
  { role: 'writer', one: 'Writer', many: 'Writers' },
]

/**
 * Who directed and who wrote the film, as two labelled lines of names.
 *
 * Each name opens the person screen, the same as a cast card. The names stand
 * as plain text rather than cards, because a reader scans a director's name
 * and does not need a photo to place it. The accessibility label carries the
 * credit, so a screen reader says `Screenplay` where a sighted reader sees the
 * line label.
 *
 * Absent for a film TMDB lists no director or writer for, which is the case
 * for an announced film, so it leaves no gap.
 */
export function DetailCrew({ crew }: { crew: CrewMember[] }) {
  const theme = useTheme()
  const painted = useServerPainted()

  const groups = GROUPS.map((group) => ({
    ...group,
    members: crew.filter((member) => member.role === group.role),
  })).filter((group) => group.members.length)

  if (!groups.length) return null

  return (
    <Motion.View
      testID="detail-crew"
      initial={painted ? false : { opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition="enter"
      style={styles.block}
    >
      {groups.map((group) => (
        <View key={group.role} style={styles.line}>
          <Typography
            variant="labelLarge"
            color={theme.colors.onSurfaceVariant}
            style={styles.label}
          >
            {group.members.length > 1 ? group.many : group.one}
          </Typography>
          <View style={styles.names}>
            {group.members.map((member) => (
              <Link key={member.id} href={`/person/${member.id}`} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${member.name}. ${member.job}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Typography variant="bodyMedium" color={theme.colors.primary}>
                    {member.name}
                  </Typography>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      ))}
    </Motion.View>
  )
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  // The label holds one width on both lines, so the names start in one column.
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  label: { width: 76, paddingTop: 1 },
  names: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 },
})
