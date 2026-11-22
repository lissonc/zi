// Story-proposal workflow: request file out, proposals file in.
//
//   1. buildRequest()   → radix_story_request_*.json  (hand this to Claude Code)
//   2. parseProposals() ← radix_story_proposals_*.json (what Claude Code writes back)
//   3. review one by one in the Stories view; rejections (with reasons) and
//      approvals (as style examples) are folded into the next request.

import { canonicalName, hasStory, entryDisplayName } from '../utils.js'

export const REJECT_REASONS = [
  { key: 'abstract',   label: 'Too abstract' },
  { key: 'long',       label: 'Too long' },
  { key: 'components', label: 'Wrong or missing component' },
  { key: 'keyword',    label: 'Keyword not anchored' },
  { key: 'confusable', label: 'Too close to another story' },
  { key: 'taste',      label: 'Just not for me' },
]

export const REQUEST_FORMAT = 'radix-story-request'
export const PROPOSALS_FORMAT = 'radix-story-proposals'

function componentInfo(e) {
  return { id: e.id, character: e.character || '', name: canonicalName(e), otherNames: (e.primitiveKeywords || []).slice(1) }
}

/** Entries that still need a story, in library order, filtered by the given options. */
export function entriesNeedingStory(entries, stories, { lessonFrom, lessonTo, scope = 'all', includePending = false } = {}) {
  return entries.filter(e => {
    if (!e.keyword?.trim() || hasStory(e)) return false
    if (!includePending && stories.proposals[e.id]) return false
    if (lessonFrom && (e.lessonNumber ?? 0) < lessonFrom) return false
    if (lessonTo && (e.lessonNumber ?? Infinity) > lessonTo) return false
    if (scope === 'noSourceStory' && e.sourceHasStory !== false) return false
    if (scope === 'rejected' && !stories.rejected[e.id]) return false
    return true
  })
}

export function buildRequest(entries, entryMap, stories, opts = {}) {
  const need = entriesNeedingStory(entries, stories, opts)
  // previously rejected characters first: they carry feedback
  need.sort((a, b) => (stories.rejected[b.id] ? 1 : 0) - (stories.rejected[a.id] ? 1 : 0))
  const picked = need.slice(0, opts.limit || 60)

  const items = picked.map(e => ({
    id: e.id,
    character: e.character,
    keyword: e.keyword,
    primitiveMeanings: e.primitiveKeywords || [],
    number: e.heisigNumber ?? null,
    lesson: e.lessonNumber ?? null,
    components: (e.componentIds || []).map(id => entryMap.get(id)).filter(Boolean).map(componentInfo),
    rejectedBefore: (stories.rejected[e.id] || []).map(r => ({
      story: r.story,
      reasons: r.reasons.map(k => REJECT_REASONS.find(x => x.key === k)?.label || k),
      note: r.note || '',
    })),
  }))

  // style signal: what was approved (and how it was edited), what was rejected and why
  const approved = stories.approved.slice(-25).map(a => {
    const e = entryMap.get(a.id)
    const o = { character: e?.character || '', keyword: e?.keyword || '', story: a.story }
    if (a.proposed) o.editedFrom = a.proposed
    return o
  })
  const reasonCounts = {}
  for (const list of Object.values(stories.rejected)) {
    for (const r of list) for (const k of r.reasons) reasonCounts[k] = (reasonCounts[k] || 0) + 1
  }

  // every entry Claude may link to, so [[names]] resolve
  const vocabulary = entries.map(e => [e.id, e.character || '', canonicalName(e), ...(e.primitiveKeywords || []).slice(1)])

  return {
    format: REQUEST_FORMAT,
    version: 1,
    createdAt: new Date().toISOString(),
    instructions: 'Write one mnemonic story per item following docs/story-guidelines.md. ' +
      'Reply with a file in the radix-story-proposals format (see tools/stories/README.md).',
    items,
    feedback: {
      approvedExamples: approved,
      rejectionReasonCounts: Object.fromEntries(
        Object.entries(reasonCounts).map(([k, v]) => [REJECT_REASONS.find(x => x.key === k)?.label || k, v])),
    },
    vocabulary,
  }
}

/** Validate an imported proposals file. Returns { list, skipped, batch } or throws. */
export function parseProposals(data, entryMap) {
  if (!data || data.format !== PROPOSALS_FORMAT || !Array.isArray(data.proposals)) {
    throw new Error('This is not a story-proposals file.')
  }
  const list = []
  const skipped = []
  for (const p of data.proposals) {
    const e = p && entryMap.get(p.id)
    if (!e) { skipped.push({ id: p?.id, why: 'no such entry in this library' }); continue }
    if (typeof p.story !== 'string' || !p.story.trim()) { skipped.push({ id: p.id, why: 'empty story' }); continue }
    if (hasStory(e)) { skipped.push({ id: p.id, why: `“${entryDisplayName(e)}” already has a story` }); continue }
    const item = { id: p.id, story: p.story.trim() }
    if (Array.isArray(p.componentIds)) item.componentIds = p.componentIds.filter(id => entryMap.has(id) && id !== p.id)
    list.push(item)
  }
  return { list, skipped, batch: data.batch || new Date().toISOString().slice(0, 10) }
}

/**
 * Work out componentIds from the [[links]] in a story. Names are matched
 * against the canonical name and every primitive keyword / keyword; when a
 * name is shared by several entries, one the entry already lists as a
 * component wins, then the earliest in the library.
 */
export function buildNameIndex(entries) {
  const idx = new Map()
  const add = (name, e) => {
    const k = name.trim().toLowerCase()
    if (!k) return
    if (!idx.has(k)) idx.set(k, [])
    idx.get(k).push(e.id)
  }
  for (const e of entries) {
    for (const pk of e.primitiveKeywords || []) add(pk, e)
    if (e.keyword) add(e.keyword, e)
  }
  return idx
}

export function componentsFromStory(story, entry, nameIndex) {
  const ids = []
  let unresolved = 0
  const current = new Set(entry.componentIds || [])
  for (const m of story.matchAll(/\[\[([^\]]*)\]\]/g)) {
    const canonical = m[1].split('|', 1)[0]
    const cands = (nameIndex.get(canonical.trim().toLowerCase()) || []).filter(id => id !== entry.id)
    if (!cands.length) { unresolved++; continue }
    const id = cands.find(c => current.has(c)) || cands[0]
    if (!ids.includes(id)) ids.push(id)
  }
  return { ids, unresolved }
}
