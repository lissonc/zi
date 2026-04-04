/** Derive the type of an entry from its fields. */
export function entryType(entry) {
  const hasKw = Boolean(entry.keyword?.trim())
  const hasPrimKw = entry.primitiveKeywords?.length > 0
  if (hasKw && hasPrimKw) return 'dual'
  if (hasKw) return 'character'
  return 'primitive'
}

/** The primary display name for an entry. */
export function entryDisplayName(entry) {
  if (entry.keyword?.trim()) return entry.keyword
  if (entry.primitiveKeywords?.length > 0) return entry.primitiveKeywords[0]
  return entry.character || 'Unnamed'
}

/**
 * Convert a story string to safe HTML, wrapping [[name]] references in a
 * styled span. Used in the editor mirror and in library/review card display.
 */
export function storyToHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(
    /\[\[([^\]]*)\]\]/g,
    (_, inner) => {
      // [[name|alias]] → display alias; [[name]] → display name
      const display = inner.includes('|') ? inner.split('|', 2)[1] : inner
      return `<span class="story-mention-chip">[[${display}]]</span>`
    }
  )
}

/**
 * Migrate old format { primitives[], characters[] } → new { entries[] }.
 * New format is passed through unchanged.
 */
export function migrateData(data) {
  if (data.entries) return data.entries

  const entries = []

  for (const p of (data.primitives || [])) {
    entries.push({
      id: p.id,
      character: p.character || '',
      keyword: '',
      primitiveKeywords: [p.name, ...p.meanings].filter(Boolean),
      heisigNumber: null,
      bookNumber: null,
      lessonNumber: null,
      story: '',
      componentIds: [],
      isMastered: false,
    })
  }

  for (const c of (data.characters || [])) {
    entries.push({
      id: c.id,
      character: c.character || '',
      keyword: c.keyword || '',
      primitiveKeywords: [],
      heisigNumber: c.heisigNumber ?? null,
      bookNumber: c.bookNumber ?? null,
      lessonNumber: c.lessonNumber ?? null,
      story: c.story || '',
      componentIds: c.primitiveIds || [],
      isMastered: c.isMastered || false,
    })
  }

  return entries
}
