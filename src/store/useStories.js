import { useState, useEffect, useCallback } from 'react'

const KEY = 'radix_stories'
const EMPTY = { proposals: {}, rejected: {}, approved: [] }

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return EMPTY
}

/**
 * Story proposals awaiting a decision, plus the decision history that feeds
 * the next request:
 *   proposals: { [entryId]: { story, componentIds?, batch } }   — pending
 *   rejected:  { [entryId]: [{ story, reasons, note, at }] }     — feedback for the next round
 *   approved:  [{ id, story, proposed?, at }]                    — recent approvals (style examples)
 */
export function useStories() {
  const [state, setState] = useState(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  /** Merge an imported batch. Returns how many proposals were added. */
  const importBatch = useCallback((list, batch) => {
    setState(s => {
      const proposals = { ...s.proposals }
      for (const p of list) proposals[p.id] = { story: p.story, componentIds: p.componentIds, batch }
      return { ...s, proposals }
    })
  }, [])

  const approve = useCallback((id, finalStory) => {
    setState(s => {
      const p = s.proposals[id]
      if (!p) return s
      const proposals = { ...s.proposals }
      delete proposals[id]
      const rejected = { ...s.rejected }
      delete rejected[id]
      const record = { id, story: finalStory, at: Date.now() }
      if (finalStory !== p.story) record.proposed = p.story
      return { proposals, rejected, approved: [...s.approved, record].slice(-300) }
    })
  }, [])

  const reject = useCallback((id, reasons, note) => {
    setState(s => {
      const p = s.proposals[id]
      if (!p) return s
      const proposals = { ...s.proposals }
      delete proposals[id]
      const prior = s.rejected[id] || []
      const rejected = { ...s.rejected, [id]: [...prior, { story: p.story, reasons, note, at: Date.now() }] }
      return { ...s, proposals, rejected }
    })
  }, [])

  /** Put the whole state back (used by undo). */
  const restore = useCallback((snapshot) => setState(snapshot), [])

  const clearPending = useCallback(() => setState(s => ({ ...s, proposals: {} })), [])

  return { ...state, state, importBatch, approve, reject, restore, clearPending }
}
