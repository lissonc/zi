import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { entryDisplayName, storyToHtml, hasStory, entryMeta, downloadJson, timestamp, readJsonFile } from '../utils.js'
import {
  REJECT_REASONS, buildRequest, parseProposals, entriesNeedingStory, buildNameIndex, componentsFromStory,
} from '../lib/stories.js'
import EntryChip from './EntryChip.jsx'

// ── Overview: request → import → review ───────────────────────────────────────

function Overview({ entries, entryMap, stories, onStart }) {
  const [lessonFrom, setLessonFrom] = useState('')
  const [lessonTo, setLessonTo] = useState('')
  const [scope, setScope] = useState('all')
  const [limit, setLimit] = useState(60)
  const [message, setMessage] = useState(null)
  const fileRef = useRef(null)

  const stats = useMemo(() => {
    let total = 0, withStory = 0
    for (const e of entries) {
      if (!e.keyword?.trim()) continue
      total++
      if (hasStory(e)) withStory++
    }
    return { total, withStory }
  }, [entries])

  const pending = Object.keys(stories.proposals).length
  const rejectedWaiting = Object.keys(stories.rejected).filter(id => !stories.proposals[id] && entryMap.has(id) && !hasStory(entryMap.get(id))).length
  const hasSourceFlag = useMemo(() => entries.some(e => e.sourceHasStory === false), [entries])

  const opts = {
    lessonFrom: lessonFrom === '' ? null : Number(lessonFrom),
    lessonTo: lessonTo === '' ? null : Number(lessonTo),
    scope,
  }
  const eligible = useMemo(
    () => entriesNeedingStory(entries, stories.state, opts).length,
    [entries, stories.state, lessonFrom, lessonTo, scope], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const size = Math.max(1, Math.min(Number(limit) || 1, eligible))

  function exportRequest() {
    const req = buildRequest(entries, entryMap, stories.state, { ...opts, limit: size })
    downloadJson(`radix_story_request_${timestamp()}.json`, req)
  }

  async function importFile(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    try {
      const data = await readJsonFile(file)
      const { list, skipped, batch } = parseProposals(data, entryMap)
      stories.importBatch(list, batch)
      setMessage({ ok: true, text: `${list.length} proposal${list.length === 1 ? '' : 's'} imported.`, skipped })
    } catch (err) {
      setMessage({ ok: false, text: err.message || 'Could not read that file.', skipped: [] })
    }
  }

  const pct = stats.total ? Math.round((stats.withStory / stats.total) * 100) : 0

  return (
    <div className="page stories">
      <div className="page-head">
        <div>
          <h1 className="page-title">Stories</h1>
          <p className="page-sub">
            {stats.withStory.toLocaleString()} of {stats.total.toLocaleString()} characters have a story ({pct}%)
          </p>
        </div>
      </div>
      <div className="meter" aria-hidden="true"><div className="meter-fill" style={{ width: `${pct}%` }} /></div>

      {pending > 0 && (
        <section className="callout">
          <div>
            <h2>{pending} proposal{pending === 1 ? '' : 's'} waiting</h2>
            <p>Read each one and approve or reject it. Nothing is added to your library until you approve it.</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onStart}>Start reviewing</button>
        </section>
      )}

      <ol className="steps">
        <li className="step">
          <h2>Ask for a batch</h2>
          <p>
            Download a request file listing characters that still need a story. It also carries your
            earlier rejections, with reasons, and recent approvals, so the next batch can match your taste.
          </p>
          <div className="step-form">
            <label className="field">
              <span>Lessons</span>
              <span className="range">
                <input className="input input-narrow" type="number" min="1" placeholder="from" value={lessonFrom} onChange={e => setLessonFrom(e.target.value)} />
                <span>to</span>
                <input className="input input-narrow" type="number" min="1" placeholder="to" value={lessonTo} onChange={e => setLessonTo(e.target.value)} />
              </span>
            </label>
            <label className="field">
              <span>Which characters</span>
              <select className="select" value={scope} onChange={e => setScope(e.target.value)}>
                <option value="all">All without a story</option>
                {hasSourceFlag && <option value="noSourceStory">Only where the book gives no story</option>}
                <option value="rejected">Only ones I rejected{rejectedWaiting ? ` (${rejectedWaiting})` : ''}</option>
              </select>
            </label>
            <label className="field">
              <span>Batch size</span>
              <input className="input input-narrow" type="number" min="1" value={limit} onChange={e => setLimit(e.target.value)} />
            </label>
          </div>
          <div className="step-actions">
            <button className="btn" onClick={exportRequest} disabled={eligible === 0}>Download request</button>
            <span className="hint">
              {eligible === 0 ? 'No characters match.' : `${size} of ${eligible.toLocaleString()} matching characters`}
            </span>
          </div>
        </li>

        <li className="step">
          <h2>Have the stories written</h2>
          <p>
            Give the request file to Claude Code in this repository and ask for story proposals.
            It follows <code>docs/story-guidelines.md</code> and returns a proposals file.
          </p>
        </li>

        <li className="step">
          <h2>Import and review</h2>
          <p>Load the proposals file. Each story then waits here for your decision.</p>
          <div className="step-actions">
            <label className="btn">
              Import proposals
              <input ref={fileRef} type="file" accept=".json" className="sr-only" onChange={importFile} />
            </label>
            {pending > 0 && <button className="link-btn" onClick={() => { if (window.confirm(`Discard all ${pending} waiting proposals?`)) stories.clearPending() }}>Discard waiting proposals</button>}
          </div>
          {message && (
            <div className={`notice${message.ok ? '' : ' notice-error'}`} role="status">
              <p>{message.text}</p>
              {message.skipped.length > 0 && (
                <details>
                  <summary>{message.skipped.length} skipped</summary>
                  <ul>{message.skipped.slice(0, 40).map((s, i) => <li key={i}><code>{String(s.id)}</code>: {s.why}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </li>
      </ol>
    </div>
  )
}

// ── One-by-one review ─────────────────────────────────────────────────────────

function Review({ entries, entryMap, stories, onPatchEntry, onExit }) {
  // The queue is fixed when the session starts, in library order.
  const [queue] = useState(() => entries.filter(e => stories.proposals[e.id]).map(e => e.id))
  const [pos, setPos] = useState(0)
  const [mode, setMode] = useState('read') // read | reject | edit
  const [reasons, setReasons] = useState([])
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState('')
  const [tally, setTally] = useState({ approved: 0, rejected: 0, skipped: 0 })
  const undoStack = useRef([])
  const nameIndex = useMemo(() => buildNameIndex(entries), [entries])
  const noteRef = useRef(null)
  const draftRef = useRef(null)

  const id = queue[pos]
  const entry = id ? entryMap.get(id) : null
  const proposal = id ? stories.proposals[id] : null
  const done = pos >= queue.length

  const next = useCallback((kind) => {
    setTally(t => ({ ...t, [kind]: t[kind] + 1 }))
    setMode('read'); setReasons([]); setNote('')
    setPos(p => p + 1)
  }, [])

  const approve = useCallback((text) => {
    if (!entry || !proposal) return
    const story = (text ?? proposal.story).trim()
    if (!story) return
    let componentIds = proposal.componentIds
    if (!componentIds || text != null) {
      const { ids, unresolved } = componentsFromStory(story, entry, nameIndex)
      if (ids.length && unresolved === 0) componentIds = ids
      else componentIds = [...new Set([...(entry.componentIds || []), ...ids])]
    }
    undoStack.current.push({ kind: 'approved', pos, stories: stories.state, id, prev: { story: entry.story, componentIds: entry.componentIds } })
    onPatchEntry(id, { story, componentIds })
    stories.approve(id, story)
    next('approved')
  }, [entry, proposal, nameIndex, pos, stories, id, onPatchEntry, next])

  const reject = useCallback(() => {
    if (!entry || !proposal) return
    undoStack.current.push({ kind: 'rejected', pos, stories: stories.state, id })
    stories.reject(id, reasons, note.trim())
    next('rejected')
  }, [entry, proposal, pos, stories, id, reasons, note, next])

  const skip = useCallback(() => {
    undoStack.current.push({ kind: 'skipped', pos })
    next('skipped')
  }, [pos, next])

  const undo = useCallback(() => {
    const u = undoStack.current.pop()
    if (!u) return
    if (u.stories) stories.restore(u.stories)
    if (u.prev) onPatchEntry(u.id, u.prev)
    setTally(t => ({ ...t, [u.kind]: Math.max(0, t[u.kind] - 1) }))
    setMode('read'); setReasons([]); setNote('')
    setPos(u.pos)
  }, [stories, onPatchEntry])

  useEffect(() => { if (mode === 'reject') noteRef.current?.focus({ preventScroll: true }) }, [mode])
  useEffect(() => {
    if (mode === 'edit') {
      const ta = draftRef.current
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
    }
  }, [mode])

  useEffect(() => {
    function onKey(e) {
      const inField = e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type === 'text')
      const mod = e.ctrlKey || e.metaKey
      if (e.key === 'Escape') {
        e.preventDefault()
        if (mode !== 'read') setMode('read'); else onExit()
        return
      }
      if (done) { if (e.key === 'Enter') { e.preventDefault(); onExit() } return }
      if (mode === 'edit') {
        if (mod && e.key === 'Enter') { e.preventDefault(); approve(draft) }
        return
      }
      if (mode === 'reject') {
        if (e.key === 'Enter') { e.preventDefault(); reject(); return }
        if (!inField || mod) {
          const n = Number(e.key)
          if (n >= 1 && n <= REJECT_REASONS.length) {
            e.preventDefault()
            const k = REJECT_REASONS[n - 1].key
            setReasons(r => r.includes(k) ? r.filter(x => x !== k) : [...r, k])
          }
        }
        return
      }
      if (inField || mod || e.altKey) return
      switch (e.key.toLowerCase()) {
        case 'a': case 'enter': e.preventDefault(); approve(); break
        case 'r': e.preventDefault(); setMode('reject'); break
        case 'e': e.preventDefault(); setDraft(proposal?.story || ''); setMode('edit'); break
        case 's': case 'arrowright': e.preventDefault(); skip(); break
        case 'z': case 'arrowleft': e.preventDefault(); undo(); break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, done, draft, proposal, approve, reject, skip, undo, onExit])

  if (done) {
    return (
      <div className="page stories-review">
        <div className="review-done">
          <h1 className="page-title">Batch reviewed</h1>
          <p className="done-tally">
            <span><b>{tally.approved}</b> approved</span>
            <span><b>{tally.rejected}</b> rejected</span>
            <span><b>{tally.skipped}</b> skipped</span>
          </p>
          <p className="hint">
            Rejected characters, with your reasons, go into the next request so they can be rewritten.
          </p>
          <div className="step-actions center">
            {undoStack.current.length > 0 && <button className="btn" onClick={undo}>Undo last</button>}
            <button className="btn btn-primary" onClick={onExit}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  // Proposal vanished (decided elsewhere, or entry deleted): move on.
  if (!entry || !proposal) {
    return (
      <div className="page stories-review">
        <p className="empty">This proposal is no longer available. <button className="link-btn" onClick={skip}>Next</button></p>
      </div>
    )
  }

  const components = (entry.componentIds || []).map(cid => entryMap.get(cid)).filter(Boolean)
  const before = stories.rejected[id] || []

  return (
    <div className="page stories-review">
      <div className="review-bar">
        <button className="link-btn" onClick={onExit}>← Stories</button>
        <span className="review-pos">{pos + 1} of {queue.length}</span>
        <button className="link-btn" onClick={undo} disabled={undoStack.current.length === 0} title="Undo (Z)">Undo</button>
      </div>
      <div className="meter" aria-hidden="true"><div className="meter-fill" style={{ width: `${(pos / queue.length) * 100}%` }} /></div>

      <article className="proposal">
        <div className="proposal-glyph">{entry.character}</div>
        <h1 className="proposal-keyword">{entryDisplayName(entry)}</h1>
        <p className="proposal-meta">
          {[entryMeta(entry), entry.sourcePage ? `book p. ${entry.sourcePage}` : ''].filter(Boolean).join(' · ')}
        </p>
        {components.length > 0 && (
          <div className="chips center">{components.map(c => <EntryChip key={c.id} entry={c} />)}</div>
        )}

        {mode === 'edit' ? (
          <textarea
            ref={draftRef}
            className="input proposal-edit"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            aria-label="Edit story"
          />
        ) : (
          <p className="proposal-story" dangerouslySetInnerHTML={{ __html: storyToHtml(proposal.story) }} />
        )}

        {before.length > 0 && mode === 'read' && (
          <details className="proposal-before">
            <summary>Rejected {before.length === 1 ? 'once' : `${before.length} times`} before</summary>
            {before.map((b, i) => (
              <p key={i}>
                <span dangerouslySetInnerHTML={{ __html: storyToHtml(b.story) }} />
                {(b.reasons.length > 0 || b.note) && (
                  <em> ({[...b.reasons.map(k => REJECT_REASONS.find(x => x.key === k)?.label || k), b.note].filter(Boolean).join('; ')})</em>
                )}
              </p>
            ))}
          </details>
        )}
      </article>

      {mode === 'read' && (
        <div className="decide">
          <button className="btn btn-reject btn-lg" onClick={() => setMode('reject')}>Reject <kbd>R</kbd></button>
          <button className="btn btn-lg" onClick={() => { setDraft(proposal.story); setMode('edit') }}>Edit <kbd>E</kbd></button>
          <button className="btn btn-approve btn-lg" onClick={() => approve()}>Approve <kbd>A</kbd></button>
        </div>
      )}
      {mode === 'read' && (
        <p className="decide-more"><button className="link-btn" onClick={skip}>Decide later <kbd>S</kbd></button></p>
      )}

      {mode === 'edit' && (
        <div className="decide">
          <button className="btn btn-lg" onClick={() => setMode('read')}>Cancel <kbd>Esc</kbd></button>
          <button className="btn btn-approve btn-lg" onClick={() => approve(draft)} disabled={!draft.trim()}>Approve edited <kbd>Ctrl ↵</kbd></button>
        </div>
      )}

      {mode === 'reject' && (
        <div className="reject-panel">
          <p className="reject-title">Why? <span className="hint">Optional. It steers the rewrite.</span></p>
          <div className="reasons">
            {REJECT_REASONS.map((r, i) => (
              <button
                key={r.key}
                className={`reason${reasons.includes(r.key) ? ' active' : ''}`}
                onClick={() => setReasons(rs => rs.includes(r.key) ? rs.filter(x => x !== r.key) : [...rs, r.key])}
                aria-pressed={reasons.includes(r.key)}
              ><kbd>{i + 1}</kbd> {r.label}</button>
            ))}
          </div>
          <input
            ref={noteRef}
            className="input"
            type="text"
            placeholder="Anything else? e.g. “no violence”, “use the tree as a ladder”"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => {
              // digits toggle reasons only while the note is still empty
              const n = Number(e.key)
              if (!note && n >= 1 && n <= REJECT_REASONS.length) {
                e.preventDefault(); e.stopPropagation()
                const k = REJECT_REASONS[n - 1].key
                setReasons(rs => rs.includes(k) ? rs.filter(x => x !== k) : [...rs, k])
              }
            }}
          />
          <div className="decide">
            <button className="btn btn-lg" onClick={() => setMode('read')}>Cancel <kbd>Esc</kbd></button>
            <button className="btn btn-reject btn-lg" onClick={reject}>Reject <kbd>↵</kbd></button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StoriesView({ entries, entryMap, stories, onPatchEntry }) {
  const [reviewing, setReviewing] = useState(false)
  if (reviewing) {
    return <Review entries={entries} entryMap={entryMap} stories={stories} onPatchEntry={onPatchEntry} onExit={() => setReviewing(false)} />
  }
  return <Overview entries={entries} entryMap={entryMap} stories={stories} onStart={() => setReviewing(true)} />
}
