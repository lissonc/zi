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
 * Convert a story string to safe HTML for reading: [[name]] and [[name|alias]]
 * become an underlined word (the brackets are dropped). The editor uses
 * storyToHtmlMirror instead, which keeps every character in place.
 */
export function storyToHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(
    /\[\[([^\]]*)\]\]/g,
    (_, inner) => {
      // [[name|alias]] → display alias only; [[name]] → display name
      const display = inner.includes('|') ? inner.split('|', 2)[1] : inner
      return `<span class="story-mention-chip">${display}</span>`
    }
  )
}

/**
 * Mirror variant for the editor overlay. Must preserve the exact character
 * width of the raw text so the textarea caret stays aligned. For [[a|b]]
 * renders the canonical part "a|" dimmed but in-layout; for [[a]] identical
 * to storyToHtml.
 */
export function storyToHtmlMirror(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(
    /\[\[([^\]]*)\]\]/g,
    (_, inner) => {
      const pipeIdx = inner.indexOf('|')
      if (pipeIdx < 0) {
        return `<span class="story-mention-chip">[[${inner}]]</span>`
      }
      const canonical = inner.slice(0, pipeIdx)
      const alias     = inner.slice(pipeIdx + 1)
      // Keep canonical+pipe in layout (same width as the textarea text) but dim it
      return `<span class="story-mention-chip">[[<span class="mention-canonical">${canonical}|</span>${alias}]]</span>`
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
      strokeCount: null,
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
      strokeCount: c.strokeCount ?? null,
      story: c.story || '',
      componentIds: c.primitiveIds || [],
      isMastered: c.isMastered || false,
    })
  }

  return entries
}

/** The name used to link to an entry from a story: first primitive keyword, else keyword. */
export function canonicalName(entry) {
  return entry.primitiveKeywords?.[0] || entry.keyword || entry.character || ''
}

const SCAFFOLD_RE = /^\s*(\[\[[^\]]*\]\]\s*(\+\s*)?)*$/

/**
 * A "scaffold" is a story field that only lists linked components
 * (e.g. "[[sun]] + [[moon]]") — a placeholder, not a mnemonic yet.
 */
export function isScaffold(story) {
  return SCAFFOLD_RE.test(story || '')
}

/** True when the entry has a real mnemonic story, not just a component scaffold. */
export function hasStory(entry) {
  return Boolean(entry.story?.trim()) && !isScaffold(entry.story)
}

/** Short meta line: "#12 · Lesson 1 · 4 strokes". */
export function entryMeta(entry) {
  const parts = []
  if (entry.heisigNumber) parts.push(`#${entry.heisigNumber}`)
  if (entry.lessonNumber) parts.push(`Lesson ${entry.lessonNumber}`)
  if (entry.strokeCount) parts.push(`${entry.strokeCount} stroke${entry.strokeCount === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function timestamp() {
  return new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try { resolve(JSON.parse(e.target.result)) } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
