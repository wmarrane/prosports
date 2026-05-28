export type ChangelogSection = 'Added' | 'Changed' | 'Fixed' | 'Removed'

export type Release = {
  version: string
  date: string
  sections: Partial<Record<ChangelogSection, string[]>>
}

const RELEASE_HEADER = /^##\s*\[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/
const SECTION_HEADER = /^###\s+(Added|Changed|Fixed|Removed)\s*$/
const BULLET = /^-\s+(.*\S)\s*$/

export function parseChangelog(md: string): Release[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const releases: Release[] = []
  let current: Release | null = null
  let currentSection: ChangelogSection | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    const releaseMatch = line.match(RELEASE_HEADER)
    if (releaseMatch) {
      current = { version: releaseMatch[1], date: releaseMatch[2], sections: {} }
      currentSection = null
      releases.push(current)
      continue
    }

    if (!current) continue

    const sectionMatch = line.match(SECTION_HEADER)
    if (sectionMatch) {
      currentSection = sectionMatch[1] as ChangelogSection
      if (!current.sections[currentSection]) current.sections[currentSection] = []
      continue
    }

    if (!currentSection) continue

    const bulletMatch = line.match(BULLET)
    if (bulletMatch) {
      current.sections[currentSection]!.push(bulletMatch[1])
    }
  }

  return releases
}
